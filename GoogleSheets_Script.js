/**
 * Amcro India Pvt Ltd - Google Sheets Apps Script Backend
 * 
 * Paste this script in your Google Sheet:
 * Extensions -> Apps Script
 * Replace any default code, save, and deploy as a Web App.
 */

const SHEET_NAME = "Records";

// Initialize sheet and verify headers exist
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Columns: Site | Date | Worker Name | Wage | Payment Status | Timestamp
    sheet.appendRow(["Site", "Date", "Worker Name", "Wage", "Payment Status", "Timestamp"]);
    
    // Format headers to look professional
    const headerRange = sheet.getRange(1, 1, 1, 6);
    headerRange.setFontWeight("bold");
    headerRange.setBackgroundColor("#1C2B33");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // Auto-adjust column widths
    sheet.setColumnWidth(1, 180); // Site
    sheet.setColumnWidth(2, 120); // Date
    sheet.setColumnWidth(3, 160); // Worker Name
    sheet.setColumnWidth(4, 100); // Wage
    sheet.setColumnWidth(5, 120); // Payment Status
    sheet.setColumnWidth(6, 180); // Timestamp
  }
  return sheet;
}

// 1. GET Endpoint: Returns all rows in JSON format for the Owner Dashboard
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const records = [];
    
    // Skip header row at index 0
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0] || !row[1]) continue; // Skip empty rows
      
      // Formatting date object to YYYY-MM-DD
      let dateString = "";
      if (row[1] instanceof Date) {
        // Correct timezone offset offset formatting
        const d = row[1];
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const date = String(d.getDate()).padStart(2, "0");
        dateString = `${year}-${month}-${date}`;
      } else {
        dateString = String(row[1]);
      }
      
      records.push({
        site: row[0],
        date: dateString,
        name: row[2],
        wage: Number(row[3]) || 0,
        status: String(row[4] || "Unpaid").trim()
      });
    }
    
    const output = JSON.stringify({ ok: true, records: records });
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    const output = JSON.stringify({ ok: false, error: err.toString() });
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. POST Endpoint: Saves new records or overwrites existing records for the same Site & Date
function doPost(e) {
  // Use a lock to prevent concurrent write issues when multiple supervisors submit at once
  const lock = LockService.getScriptLock();
  try {
    // Wait for up to 30 seconds for lock
    lock.waitLock(30000);
    
    const sheet = getOrCreateSheet();
    const postData = JSON.parse(e.postData.contents);
    
    const action = postData.action || "write";
    const site = postData.site;
    const date = postData.date;
    const rows = postData.rows; // Array of { name, wage, status }
    
    if (!site || !date) {
      throw new Error("Missing site or date in payload.");
    }
    
    if (action === "write") {
      // Clean up / delete existing records for this site + date first to implement overwrites
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const range = sheet.getRange(2, 1, lastRow - 1, 6);
        const values = range.getValues();
        
        // Loop backwards so index offsets don't shift when rows are deleted
        for (let i = values.length - 1; i >= 0; i--) {
          const rowSite = values[i][0];
          
          let rowDateStr = "";
          if (values[i][1] instanceof Date) {
            const d = values[i][1];
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const dateVal = String(d.getDate()).padStart(2, "0");
            rowDateStr = `${year}-${month}-${dateVal}`;
          } else {
            rowDateStr = String(values[i][1]);
          }
          
          if (rowSite === site && rowDateStr === date) {
            // Delete this row (sheet row index is 1-indexed, starts from row 2)
            sheet.deleteRow(i + 2);
          }
        }
      }
      
      // Append the new rows
      if (rows && rows.length > 0) {
        const timestamp = new Date();
        const rowsToAdd = rows.map(r => [
          site,
          date,
          r.name,
          Number(r.wage) || 0,
          r.status || "Unpaid",
          timestamp
        ]);
        
        // Write block in bulk (much faster than individual appends)
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rowsToAdd.length, 6).setValues(rowsToAdd);
      }
      
      const output = JSON.stringify({ ok: true });
      return ContentService.createTextOutput(output)
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error("Unknown action: " + action);
    
  } catch (err) {
    const output = JSON.stringify({ ok: false, error: err.toString() });
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
      
  } finally {
    // Release the script lock
    lock.releaseLock();
  }
}
