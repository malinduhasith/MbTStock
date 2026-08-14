# Google Sheets setup

MbT Stock uses one Google Spreadsheet with three tabs:

- `Tools`: the current inventory and custody state
- `Employees`: the employee directory and active status
- `Tool_Movements`: append-only checkout, return, and hand-off history

The application creates the tabs, exact headers, frozen header rows, and
fictional demonstration rows when the spreadsheet is blank.

## 1. Create Google credentials

1. Create or select a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account for MbT Stock.
4. Create a JSON key for that service account and store it securely.

Do not commit the JSON key and do not paste it into client-side code.

## 2. Create and share the spreadsheet

1. Create a blank Google Spreadsheet.
2. Copy the spreadsheet ID from the URL between `/d/` and `/edit`.
3. Share the spreadsheet as **Editor** with the service-account email from the
   JSON key.

The spreadsheet should not be shared publicly.

## 3. Configure the application

Set these values in `.env.local` for local development and in the Vercel
project's Environment Variables for deployed environments:

```text
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=mbt-stock@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Set all three values together. The application deliberately refuses a partial
configuration. In Vercel, keep these variables available only to the server;
do not prefix them with `NEXT_PUBLIC_`.

## 4. Verify

Start or redeploy MbT Stock, then open the application. The sidebar should show
**Google Sheets connected**. Check out one fictional tool and verify that:

1. the matching `Tools` row changes;
2. its `row_version` increments;
3. one new `Tool_Movements` row is appended;
4. the service-account credentials do not appear in browser developer tools.

Any employee can perform a return. A hand-off changes the current holder while
preserving `checked_out_at` and `checked_out_at_original`.
