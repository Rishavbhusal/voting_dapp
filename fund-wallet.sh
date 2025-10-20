#!/bin/bash

echo "🔧 Solana Wallet Funding Helper"
echo "================================"

# Check if validator is running
if ! pgrep -f "solana-test-validator" > /dev/null; then
    echo "❌ Solana test validator is not running!"
    echo "Please start it with: solana-test-validator"
    exit 1
fi

echo "✅ Solana test validator is running"

# Get current config
echo "📊 Current Solana config:"
solana config get

echo ""
echo "💰 Current wallet balance:"
solana balance

echo ""
echo "🔑 To fund your frontend wallet:"
echo "1. Connect your wallet in the frontend (http://localhost:8081/)"
echo "2. Copy your wallet's public key"
echo "3. Run: solana airdrop 10 YOUR_WALLET_PUBKEY"
echo ""
echo "💡 Or use Phantom's built-in faucet if available"
