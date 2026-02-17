use anchor_lang::prelude::*;
use std::str::FromStr;

declare_id!("3yWZmpSi33KFP4zqWcGxSj4qHfxejbvNwCWgCS9pEgNo");

// === CONFIGURATION ====

// Replace this string with your admin wallet pubkey (base58)
const ADMIN: &str = "Bundt9yGXifxnNMWJMnEQj2EwNPtyJiq7XeqE9Eb98Mg";

#[program]
pub mod voting {
    use super::*;

    // Create a new poll (only ADMIN)
    pub fn create_poll(
        ctx: Context<InitializePoll>,
        title: String,
        image: String,
        description: String,
        starts_at: i64,
        ends_at: i64,
    ) -> Result<()> {
        // check admin
        assert_admin(&ctx.accounts.payer.key())?;

        // basic time sanity
        require!(ends_at > starts_at, ErrorCode::InvalidTimeRange);
        require!(starts_at > Clock::get()?.unix_timestamp, ErrorCode::InvalidTimeRange);

        // Validate string lengths
        require!(title.len() <= 100, ErrorCode::StringTooLong);
        require!(image.len() <= 2000, ErrorCode::StringTooLong);
        require!(description.len() <= 500, ErrorCode::StringTooLong);

        msg!("Poll Create: {}", title);

        let poll = &mut ctx.accounts.poll;
        poll.id = generate_unique_id(&ctx.accounts.payer.key(), &title)?;
        poll.title = title;
        poll.image = image;
        poll.description = description;
        poll.starts_at = starts_at;
        poll.ends_at = ends_at;
        poll.director = *ctx.accounts.payer.key;
        poll.timestamp = Clock::get()?.unix_timestamp;
        poll.votes = 0;
        poll.voters = Vec::new();
        poll.deleted = false;
        poll.contestants = Vec::new();
        poll.finalized = false;
        poll.winner = None;

        Ok(())
    }

    // Update poll metadata (only ADMIN). Title change is NOT allowed because title is used as PDA seed.
    pub fn update_poll(
        ctx: Context<UpdatePoll>,
        // note: title param is used for PDA derivation in the accounts; do NOT change the title value here
        _title: String,
        image: String,
        description: String,
        starts_at: i64,
        ends_at: i64,
    ) -> Result<()> {
        assert_admin(&ctx.accounts.payer.key())?;

        let poll = &mut ctx.accounts.poll;
        let now = Clock::get()?.unix_timestamp;

        // Prevent editing after poll started
        require!(now < poll.starts_at, ErrorCode::PollAlreadyStarted);

        require!(ends_at > starts_at, ErrorCode::InvalidTimeRange);

        // Validate string lengths
        require!(image.len() <= 500, ErrorCode::StringTooLong);
        require!(description.len() <= 500, ErrorCode::StringTooLong);

        msg!("Update Poll: {}", poll.title);

        // We do not change title (PDA), only other metadata
        poll.image = image;
        poll.description = description;
        poll.starts_at = starts_at;
        poll.ends_at = ends_at;

        Ok(())
    }

    // Delete the poll account (only ADMIN). Prevent deleting if votes exist.
    pub fn delete_poll(ctx: Context<DeletePoll>, _title: String) -> Result<()> {
        assert_admin(&ctx.accounts.payer.key())?;
        let poll = &ctx.accounts.poll;

        // Prevent deletion after votes have been cast
        require!(poll.votes == 0, ErrorCode::CannotDeleteWithVotes);

        msg!("Delete Poll: {}", poll.title);
        // The `close = payer` in account attribute will close the account and send lamports to payer automatically.
        Ok(())
    }

    // Add a contestant to an existing poll (only ADMIN)
    pub fn contest(ctx: Context<Contest>, title: String, name: String, image: String) -> Result<()> {
        assert_admin(&ctx.accounts.payer.key())?;

        let poll = &mut ctx.accounts.poll;

        // Prevent adding after poll started
        let now = Clock::get()?.unix_timestamp;
        require!(now < poll.starts_at, ErrorCode::PollAlreadyStarted);

        // Validate string lengths
        require!(name.len() <= 50, ErrorCode::StringTooLong);
        require!(image.len() <= 200, ErrorCode::StringTooLong);
        require!(name.len() > 0, ErrorCode::EmptyString);

        // Prevent duplicate contestant names
        if poll.contestants.iter().any(|c| c.name == name) {
            return err!(ErrorCode::DuplicateContestantName);
        }

        // Prevent too many contestants
        require!(poll.contestants.len() < 20, ErrorCode::TooManyContestants);

        let index = poll.contestants.len() as u64;
        let contestant = Contestant {
            id: index,
            name,
            image,
            voter: *ctx.accounts.payer.key, // admin added
            votes: 0,
            voters: Vec::new(),
        };

        poll.contestants.push(contestant);

        msg!("Added contestant id={} to poll '{}'", index, poll.title);
        Ok(())
    }

    // Cast a vote for a contestant
    // Rules:
    // 1. Poll must be in "live" state (active - between start and end time)
    // 2. One user can only vote ONCE per poll (for one candidate only)
    pub fn vote(ctx: Context<Vote>, cid: u64) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        // Use blockchain time (Clock::get) - accurate on devnet/mainnet
        let now = Clock::get()?.unix_timestamp;

        // ============================================
        // RULE 1: Poll must be in "live" state
        // ============================================
        // Check if poll has started using accurate blockchain time
        require!(now >= poll.starts_at, ErrorCode::PollNotStarted);
        
        // Check if poll has ended using accurate blockchain time
        require!(now <= poll.ends_at, ErrorCode::PollEnded);

        // ============================================
        // RULE 2: One user can only vote ONCE per poll
        // ============================================
        // Check if this user has already voted in this poll
        // This ensures one user can only vote for ONE candidate in one poll
        if poll.voters.contains(&ctx.accounts.payer.key()) {
            return err!(ErrorCode::AlreadyVoted);
        }

        // Validate contestant ID
        let ucid = cid as usize;
        require!(ucid < poll.contestants.len(), ErrorCode::InvalidContestant);

        // Register the vote at poll level
        // This marks the user as having voted in this poll
        poll.votes = poll.votes.saturating_add(1);
        poll.voters.push(*ctx.accounts.payer.key);

        // Update the specific contestant that was voted for
        let contestant = poll.contestants.get_mut(ucid).unwrap();
        
        // Defensive check: ensure user hasn't voted for this contestant before
        // (This should never happen due to poll-level check, but adds extra safety)
        if contestant.voters.contains(&ctx.accounts.payer.key()) {
            return err!(ErrorCode::AlreadyVoted);
        }
        
        // Increment contestant vote count and record the voter
        contestant.votes = contestant.votes.saturating_add(1);
        contestant.voters.push(*ctx.accounts.payer.key);

        let contestant_name = contestant.name.clone();
        let poll_title = poll.title.clone();

        msg!(
            "Vote cast by {} for contestant {} in poll '{}'",
            ctx.accounts.payer.key(),
            contestant_name,
            poll_title
        );

        Ok(())
    }

    // Finalize poll: compute winner after poll ends and mark finalized. Anyone can call after poll end.
    // Title parameter is required for PDA derivation via account constraint #[instruction(title: String)]
    pub fn finalize_poll(ctx: Context<FinalizePoll>, _title: String) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        let now = Clock::get()?.unix_timestamp;

        require!(now > poll.ends_at, ErrorCode::PollStillActive);
        require!(!poll.finalized, ErrorCode::AlreadyFinalized);
        require!(poll.contestants.len() > 0, ErrorCode::NoContestants);

        // compute winner: contestant with max votes (first max encountered wins tie-break arbitrarily)
        let mut max_votes: u64 = 0;
        let mut winner_id: Option<u64> = None;

        for c in poll.contestants.iter() {
            if c.votes > max_votes {
                max_votes = c.votes;
                winner_id = Some(c.id);
            }
        }

        poll.winner = winner_id;
        poll.finalized = true;

        match winner_id {
            Some(id) => msg!("Poll '{}' finalized. Winner contestant id = {}", poll.title, id),
            None => msg!("Poll '{}' finalized. No votes cast.", poll.title),
        }

        Ok(())
    }
}

// -----------------------
// === ACCOUNTS & Ctas ==
// -----------------------

#[derive(Accounts)]
#[instruction(title: String)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        space = 10000, // Increased base space
        payer = payer,
        seeds = [title.as_bytes(), payer.key().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct UpdatePoll<'info> {
    // We reference the poll by the same PDA seeds. Title parameter used for PDA derivation.
    #[account(
        mut,
        seeds = [title.as_bytes(), payer.key().as_ref()],
        bump,
        realloc = 9000,
        realloc::payer = payer,
        realloc::zero = true,
    )]
    pub poll: Account<'info, Poll>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeletePoll<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), payer.key().as_ref()],
        bump,
        close = payer
    )]
    pub poll: Account<'info, Poll>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct Contest<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), payer.key().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct Vote<'info> {
    #[account(mut)]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct FinalizePoll<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), payer.key().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub payer: Signer<'info>,
}


// ======== DATA =========


#[account]
pub struct Poll {
    pub id: u64,
    pub image: String,
    pub title: String,
    pub description: String,
    pub votes: u64,
    pub voters: Vec<Pubkey>,
    pub deleted: bool,
    pub director: Pubkey,
    pub starts_at: i64,
    pub ends_at: i64,
    pub timestamp: i64,
    pub contestants: Vec<Contestant>,

    // added fields
    pub finalized: bool,
    pub winner: Option<u64>, // None means no winner
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Contestant {
    pub id: u64,
    pub image: String,
    pub name: String,
    pub voter: Pubkey,
    pub votes: u64,
    pub voters: Vec<Pubkey>,
}

// -----------------------
// ====== HELPERS ========
// -----------------------

fn assert_admin(key: &Pubkey) -> Result<()> {
    let admin = Pubkey::from_str(ADMIN).map_err(|_| ErrorCode::InvalidAdminPubkey)?;
    require_keys_eq!(*key, admin, ErrorCode::Unauthorized);
    Ok(())
}

fn generate_unique_id(payer: &Pubkey, title: &str) -> Result<u64> {
    let clock = Clock::get()?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&payer.to_bytes(), &mut hasher);
    std::hash::Hash::hash(&title.as_bytes(), &mut hasher);
    std::hash::Hash::hash(&clock.unix_timestamp, &mut hasher);
    Ok(std::hash::Hasher::finish(&hasher) as u64)
}

fn calculate_poll_space(num_contestants: usize, num_voters: usize) -> usize {
    // Base size for Poll struct
    let base_size = 8 + // discriminator
        8 + // id
        4 + 100 + // title (max 100 chars)
        4 + 200 + // image (max 200 chars)
        4 + 500 + // description (max 500 chars)
        8 + // votes
        4 + (32 * num_voters) + // voters Vec
        1 + // deleted
        32 + // director
        8 + // starts_at
        8 + // ends_at
        8 + // timestamp
        4 + // contestants Vec length
        1 + // finalized
        1 + 8; // winner Option<u64>
    
    // Size for each contestant
    let contestant_size = 8 + // id
        4 + 50 + // name (max 50 chars)
        4 + 200 + // image (max 200 chars)
        32 + // voter
        8 + // votes
        4 + (32 * num_voters); // voters Vec
    
    base_size + (contestant_size * num_contestants)
}


// ====== ERRORS =========


#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("This poll has not started yet.")]
    PollNotStarted,
    #[msg("This poll has already ended.")]
    PollEnded,
    #[msg("You have already voted in this poll.")]
    AlreadyVoted,
    #[msg("Invalid contestant id.")]
    InvalidContestant,
    #[msg("This poll has already started and cannot be updated.")]
    PollAlreadyStarted,
    #[msg("End time must be greater than start time.")]
    InvalidTimeRange,
    #[msg("Cannot delete a poll that has votes.")]
    CannotDeleteWithVotes,
    #[msg("Duplicate contestant name not allowed in same poll.")]
    DuplicateContestantName,
    #[msg("Admin pubkey constant is invalid.")]
    InvalidAdminPubkey,
    #[msg("Poll is still active; cannot finalize yet.")]
    PollStillActive,
    #[msg("Poll already finalized.")]
    AlreadyFinalized,
    #[msg("String length exceeds maximum allowed.")]
    StringTooLong,
    #[msg("Empty string not allowed.")]
    EmptyString,
    #[msg("Too many contestants for this poll.")]
    TooManyContestants,
    #[msg("No contestants in poll.")]
    NoContestants,
}
