# Amcro Daily Wage Tracker - Setup Instructions

Follow these step-by-step instructions to connect your React application to Google Sheets and run it locally or host it online.

---

## Step 1: Set Up Google Sheets & Apps Script

1. **Create a Google Sheet**:
   - Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
   - Rename the spreadsheet to something like `Amcro Daily Wages`.
   - Rename the default sheet tab (at the bottom-left) from `Sheet1` to exactly `Records` (case-sensitive).

2. **Open Apps Script**:
   - In your Google Sheet, click **Extensions** -> **Apps Script** in the top menu.

3. **Paste the Script**:
   - In the Apps Script editor, delete all existing code in the `Code.gs` file.
   - Open the [GoogleSheets_Script.js](file:///Users/omsingh/Documents/Amcro%20wage%20data/GoogleSheets_Script.js) file from this project.
   - Copy all of its content and paste it into the Apps Script editor.
   - Click the **Save** icon (floppy disk) at the top of the editor.

4. **Deploy the Web App**:
   - Click the **Deploy** button in the top-right corner, then click **New deployment**.
   - Under *Select type* (gear icon), choose **Web app**.
   - Fill in the configuration:
     - **Description**: `Amcro Wage Tracker Sync API`
     - **Execute as**: `Me (your-email@gmail.com)` (This allows the script to write to *your* sheet).
     - **Who has access**: **Anyone** (This is crucial, otherwise the supervisors' devices won't be able to connect).
   - Click **Deploy**.
   - If prompted, click **Authorize access**, log into your Google account, click **Advanced** -> **Go to Untitled project (unsafe)**, and click **Allow**.
   - Once deployed, copy the **Web app URL** from the success popup. It will look like this:
     `https://script.google.com/macros/s/XXXXX/exec`

---

## Step 2: Connect the Web App URL to React

1. Open the [App.jsx](file:///Users/omsingh/Documents/Amcro%20wage%20data/src/App.jsx) file.
2. Locate the variable `SHEETS_WEBHOOK_URL` on line 22:
   ```javascript
   const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzQSGuv7-nJsY3_rcnpv8Y7iIP4OK6_YD2ixjH2-D_chlMWGwlEN1UumbrHndtFW1n1/exec";
   ```
3. If your URL is different, replace the string with the **Web app URL** you copied in Step 1.
4. Save the file.

---

## Step 3: Run the App Locally

To test the application on your computer:

1. Open your terminal in the project directory:
   `/Users/omsingh/Documents/Amcro wage data`
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Click the link shown in the terminal (usually `http://localhost:5173`) to open the app.
5. Log in as a supervisor, enter a passcode (e.g. `1828` for Grand Omaxe), add a test worker and wage, then click **Save Day's Record**. The record should instantly show up in your Google Sheet!

---

## Step 4: Host Online (Free Deployment)

To get a link your supervisors can open on their mobile phones, you can deploy to **Vercel** for free:

1. Sign up for a free account at [Vercel](https://vercel.com).
2. Install the Vercel CLI globally (optional) or just link your GitHub account.
3. The easiest way is to push this directory to a private GitHub repository.
4. On Vercel, click **Add New** -> **Project**, import your repository, and click **Deploy**.
5. Vercel will automatically build the React app and give you a public URL (e.g., `amcro-wages.vercel.app`) that you can send to your supervisors.

---

## Passcodes Summary (For reference)

- **Grand Omaxe Site, Lucknow**: `1828`
- **Meridian Site, Lucknow**: `3128`
- **Owner / Admin Dashboard**: `810128`
