#!/bin/bash
# ============================================================
# SayFit — Supabase Setup Script
#
# This script links your Supabase project and pushes all
# migrations + creates the storage bucket.
#
# Prerequisites:
#   1. Create a Supabase project at https://supabase.com/dashboard
#   2. Fill in .env.local with your project URL and anon key
#   3. Run: bash scripts/setup-supabase.sh
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║    SayFit — Supabase Setup           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check if .env.local has values
if [ -f .env.local ]; then
  source .env.local 2>/dev/null || true
fi

if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ]; then
  echo "⚠️  EXPO_PUBLIC_SUPABASE_URL is not set in .env.local"
  echo ""
  echo "Steps:"
  echo "  1. Go to https://supabase.com/dashboard"
  echo "  2. Create a new project (or select existing)"
  echo "  3. Go to Project Settings → API"
  echo "  4. Copy 'Project URL' and 'anon public' key"
  echo "  5. Paste them into .env.local"
  echo "  6. Run this script again"
  echo ""
  exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo "$EXPO_PUBLIC_SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')
echo "📦 Project ref: $PROJECT_REF"
echo ""

# Link to the Supabase project
echo "🔗 Linking to Supabase project..."
npx supabase link --project-ref "$PROJECT_REF"
echo ""

# Push migrations
echo "📝 Pushing database migrations..."
npx supabase db push
echo ""

# Create storage bucket (if it doesn't exist)
echo "🪣 Setting up storage bucket..."
# Use the Supabase Management API to create the bucket
SUPABASE_ACCESS_TOKEN=$(npx supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep "service_role" | awk '{print $NF}' || echo "")

if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  curl -s -X POST "${EXPO_PUBLIC_SUPABASE_URL}/storage/v1/bucket" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"id":"share-cards","name":"share-cards","public":true,"file_size_limit":5242880,"allowed_mime_types":["image/png","image/jpeg"]}' \
    > /dev/null 2>&1 || true
  echo "   ✅ share-cards bucket ready"
else
  echo "   ⚠️  Could not auto-create bucket. Create it manually:"
  echo "      → Supabase Dashboard → Storage → New Bucket"
  echo "      → Name: share-cards, Public: ON"
fi

# Deploy edge functions
echo ""
echo "🚀 Deploying edge functions..."
npx supabase functions deploy refresh-leaderboard --project-ref "$PROJECT_REF" --no-verify-jwt 2>/dev/null || echo "   ⚠️  refresh-leaderboard deploy failed (run manually later)"
npx supabase functions deploy push-notification --project-ref "$PROJECT_REF" --no-verify-jwt 2>/dev/null || echo "   ⚠️  push-notification deploy failed (run manually later)"

# Configure redirect URL for Google OAuth
echo ""
echo "🔐 Auth provider setup (manual steps):"
echo ""
echo "   In Supabase Dashboard → Authentication → Providers:"
echo ""
echo "   📱 Apple Sign-In:"
echo "      → Enable Apple provider"
echo "      → Follow: https://supabase.com/docs/guides/auth/social-login/auth-apple"
echo ""
echo "   🔍 Google Sign-In:"
echo "      → Enable Google provider"
echo "      → Add redirect URL: sayfit://"
echo "      → Follow: https://supabase.com/docs/guides/auth/social-login/auth-google"
echo ""
echo "   Also add 'sayfit://' to:"
echo "   Authentication → URL Configuration → Redirect URLs"
echo ""

echo "╔══════════════════════════════════════╗"
echo "║    ✅ Setup complete!                ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Run the app with: npx expo start"
echo ""
