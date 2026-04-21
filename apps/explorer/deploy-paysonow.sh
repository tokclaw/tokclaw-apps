#!/bin/bash
# Deploy explorer-paysonow using proper Vite build process
set -e

EXPLORER_DIR="/Users/dome/project/otterevm/tempo-apps-dev/apps/explorer"
cd "$EXPLORER_DIR"

echo "🔨 Building explorer..."
pnpm build

echo "📝 Patching dist/server/wrangler.json for paysonow..."

# Read the original wrangler.json paysonow env config
PAYSONOW_NAME=$(cat wrangler.json | jq -r '.env.paysonow.name')
PAYSONOW_VARS=$(cat wrangler.json | jq '.env.paysonow.vars')
PAYSONOW_ROUTES=$(cat wrangler.json | jq '.env.paysonow.routes')

# Update dist/server/wrangler.json
cat dist/server/wrangler.json | jq "
  .name = \"$PAYSONOW_NAME\" |
  .vars = $PAYSONOW_VARS |
  .triggers.routes = $PAYSONOW_ROUTES
" > dist/server/wrangler-paysonow.json

echo "🚀 Deploying $PAYSONOW_NAME..."
pnpm exec wrangler deploy --config dist/server/wrangler-paysonow.json

echo "✅ Deploy complete!"
echo "🌐 URL: https://$PAYSONOW_NAME.tokenine.workers.dev"
