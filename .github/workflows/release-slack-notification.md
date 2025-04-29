name: Release Slack Notification
on:
  workflow_call:

jobs:
  notify-slack:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack on Release
        uses: slackapi/slack-github-action@v1.26.0
        with:
          payload: |
            {
              "text": "*New Release Created!* 🚀",
              "attachments": [
                {
                  "color": "#36a64f",
                  "title": "${{ github.event.release.name }} - ${{ github.repository }}",
                  "title_link": "${{ github.event.release.html_url }}",
                  "text": "${{ github.event.release.body }}",
                  "footer": "GitHub Releases",
                  "footer_icon": "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
                  "ts": ${{ toJson(github.event.release.published_at) }}
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          