/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/voting.json`.
 */
export type Voting = {
  "address": "DExwUvcLqxYi5grCn9XtweCEPHSWUHfNAaad88ksuyhb",
  "metadata": {
    "name": "voting",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "contest",
      "discriminator": [
        218,
        11,
        35,
        94,
        201,
        156,
        120,
        251
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "arg",
                "path": "title"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "image",
          "type": "string"
        }
      ]
    },
    {
      "name": "createPoll",
      "discriminator": [
        182,
        171,
        112,
        238,
        6,
        219,
        14,
        110
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "arg",
                "path": "title"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "image",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "startsAt",
          "type": "i64"
        },
        {
          "name": "endsAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "deletePoll",
      "discriminator": [
        156,
        80,
        237,
        248,
        65,
        44,
        143,
        152
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "arg",
                "path": "title"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        }
      ]
    },
    {
      "name": "finalizePoll",
      "discriminator": [
        90,
        57,
        229,
        211,
        20,
        47,
        151,
        93
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "arg",
                "path": "title"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updatePoll",
      "discriminator": [
        188,
        131,
        217,
        106,
        140,
        114,
        130,
        5
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "arg",
                "path": "title"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "image",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "startsAt",
          "type": "i64"
        },
        {
          "name": "endsAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "vote",
      "discriminator": [
        227,
        110,
        155,
        23,
        136,
        126,
        172,
        25
      ],
      "accounts": [
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "arg",
                "path": "title"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "cid",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "poll",
      "discriminator": [
        110,
        234,
        167,
        188,
        231,
        136,
        153,
        111
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "You are not authorized to perform this action."
    },
    {
      "code": 6001,
      "name": "pollNotStarted",
      "msg": "This poll has not started yet."
    },
    {
      "code": 6002,
      "name": "pollEnded",
      "msg": "This poll has already ended."
    },
    {
      "code": 6003,
      "name": "alreadyVoted",
      "msg": "You have already voted in this poll."
    },
    {
      "code": 6004,
      "name": "invalidContestant",
      "msg": "Invalid contestant id."
    },
    {
      "code": 6005,
      "name": "pollAlreadyStarted",
      "msg": "This poll has already started and cannot be updated."
    },
    {
      "code": 6006,
      "name": "invalidTimeRange",
      "msg": "End time must be greater than start time."
    },
    {
      "code": 6007,
      "name": "cannotDeleteWithVotes",
      "msg": "Cannot delete a poll that has votes."
    },
    {
      "code": 6008,
      "name": "duplicateContestantName",
      "msg": "Duplicate contestant name not allowed in same poll."
    },
    {
      "code": 6009,
      "name": "invalidAdminPubkey",
      "msg": "Admin pubkey constant is invalid."
    },
    {
      "code": 6010,
      "name": "pollStillActive",
      "msg": "Poll is still active; cannot finalize yet."
    },
    {
      "code": 6011,
      "name": "alreadyFinalized",
      "msg": "Poll already finalized."
    },
    {
      "code": 6012,
      "name": "stringTooLong",
      "msg": "String length exceeds maximum allowed."
    },
    {
      "code": 6013,
      "name": "emptyString",
      "msg": "Empty string not allowed."
    },
    {
      "code": 6014,
      "name": "tooManyContestants",
      "msg": "Too many contestants for this poll."
    },
    {
      "code": 6015,
      "name": "noContestants",
      "msg": "No contestants in poll."
    }
  ],
  "types": [
    {
      "name": "contestant",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "image",
            "type": "string"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "votes",
            "type": "u64"
          },
          {
            "name": "voters",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "poll",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "image",
            "type": "string"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "votes",
            "type": "u64"
          },
          {
            "name": "voters",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "deleted",
            "type": "bool"
          },
          {
            "name": "director",
            "type": "pubkey"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "contestants",
            "type": {
              "vec": {
                "defined": {
                  "name": "contestant"
                }
              }
            }
          },
          {
            "name": "finalized",
            "type": "bool"
          },
          {
            "name": "winner",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    }
  ]
};
