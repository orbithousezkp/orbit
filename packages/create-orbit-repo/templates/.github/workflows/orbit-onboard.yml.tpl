name: Orbit Adopter Onboard

# One-time onboarding handshake. Run manually via:
#   gh workflow run orbit-onboard.yml
#
# Reads memory/orbit-lineage.json. If handshakeOptedIn is true and
# handshakeStatus is "pending", generates a handshake message for the
# mothership and either:
#   (a) auto-creates the issue on the mothership repo when ORBIT_MOTHERSHIP_PAT
#       is set as a repository secret (PAT with `issues:write` on mothership)
#   (b) otherwise: prints the message to the workflow log for you to paste
#       into a new issue at https://github.com/{{MOTHERSHIP_REPO}}/issues/new

on:
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  onboard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Read lineage
        id: lineage
        run: |
          if [ ! -f memory/orbit-lineage.json ]; then
            echo "no memory/orbit-lineage.json — nothing to handshake"
            exit 0
          fi
          OPT_IN=$(jq -r .handshakeOptedIn memory/orbit-lineage.json)
          STATUS=$(jq -r .handshakeStatus memory/orbit-lineage.json)
          PARENT=$(jq -r .parent memory/orbit-lineage.json)
          if [ "$OPT_IN" != "true" ]; then
            echo "handshakeOptedIn is false; nothing to send. To opt in, edit memory/orbit-lineage.json."
            exit 0
          fi
          if [ "$STATUS" != "pending" ]; then
            echo "handshakeStatus is $STATUS; already sent. To resend, set status to 'pending'."
            exit 0
          fi
          echo "parent=$PARENT" >> "$GITHUB_OUTPUT"
          echo "opt_in=true" >> "$GITHUB_OUTPUT"

      - name: Build handshake message
        if: steps.lineage.outputs.opt_in == 'true'
        id: msg
        env:
          REPO: ${{ github.repository }}
          PUBLIC_URL: ${{ vars.ORBIT_PUBLIC_URL }}
        run: |
          WELL_KNOWN="${PUBLIC_URL%/}/.well-known/orbit.json"
          {
            echo "title=adopter handshake: $REPO"
            echo "body<<EOF"
            echo "## Adopter Handshake"
            echo ""
            echo "Repo: https://github.com/$REPO"
            echo "Well-known: $WELL_KNOWN"
            echo "Scaffolder version: {{SCAFFOLDER_VERSION}}"
            echo ""
            echo "This issue confirms the lineage backlink in our public well-known. The mothership's next cycle will fetch it and verify."
            echo "EOF"
          } >> "$GITHUB_OUTPUT"

      - name: Auto-post to mothership (when PAT provided)
        if: steps.lineage.outputs.opt_in == 'true' && env.ORBIT_MOTHERSHIP_PAT != ''
        env:
          GH_TOKEN: ${{ secrets.ORBIT_MOTHERSHIP_PAT }}
          ORBIT_MOTHERSHIP_PAT: ${{ secrets.ORBIT_MOTHERSHIP_PAT }}
        run: |
          gh issue create \
            --repo "${{ steps.lineage.outputs.parent }}" \
            --title "${{ steps.msg.outputs.title }}" \
            --body  "${{ steps.msg.outputs.body }}" \
            --label "orbit:adopter-handshake"

      - name: Print manual fallback
        if: steps.lineage.outputs.opt_in == 'true' && env.ORBIT_MOTHERSHIP_PAT == ''
        env:
          ORBIT_MOTHERSHIP_PAT: ${{ secrets.ORBIT_MOTHERSHIP_PAT }}
        run: |
          echo ""
          echo "════════════════════════════════════════════════════════════════"
          echo "  No ORBIT_MOTHERSHIP_PAT secret found. Paste this manually:"
          echo "  https://github.com/${{ steps.lineage.outputs.parent }}/issues/new"
          echo "════════════════════════════════════════════════════════════════"
          echo ""
          echo "Title:"
          echo "${{ steps.msg.outputs.title }}"
          echo ""
          echo "Body:"
          echo "${{ steps.msg.outputs.body }}"
          echo ""
          echo "Add label: orbit:adopter-handshake"
