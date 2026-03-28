#!/bin/bash

echo "🧪 Testing Helmfile Configuration for slack-bot"
echo "================================================"
echo ""

cd repos/platform/metabob-apps || exit 1

echo "📋 1. Checking helmfile list..."
helmfile -e production -l name=slack-bot list

echo ""
echo "📋 2. Running helmfile diff..."
helmfile -e production -l name=slack-bot diff

echo ""
echo "📋 3. If errors above, here's the helm template output:"
helm template slack-bot charts/slack-bot/ \
  --values charts/slack-bot/values/production.slack-bot.values.yaml \
  --values charts/slack-bot/values/production.slack-bot.secrets.yaml \
  --set-string image.tag=v1.0.1
