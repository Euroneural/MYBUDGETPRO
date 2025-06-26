// This is a helper script to fix the calendar transaction display
// It updates the renderCalendar method to properly filter and display transactions

// First, let's find the exact content to replace
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// The target content to replace
const targetContent = `        // Group transactions by day
        const transactionsByDay = {};
        monthlyTransactions.forEach(t => {
            const day = new Date(t.date).getDate();
            if (!transactionsByDay[day]) {
                transactionsByDay[day] = [];
            }
            transactionsByDay[day].push(t);
        });`;

// The new content with proper month/year validation
const newContent = `        // Group transactions by day with proper month/year validation
        const transactionsByDay = {};
        console.log('Grouping ' + monthlyTransactions.length + ' transactions for ' + (month + 1) + '/' + year);
        
        monthlyTransactions.forEach(t => {
            const transactionDate = new Date(t.date);
            const day = transactionDate.getDate();
            const transactionMonth = transactionDate.getMonth();
            const transactionYear = transactionDate.getFullYear();
            
            // Only include if it's in the current month we're displaying
            if (transactionMonth === month && transactionYear === year) {
                if (!transactionsByDay[day]) {
                    transactionsByDay[day] = [];
                }
                transactionsByDay[day].push(t);
                console.log('Added transaction to day ' + day + ':', t);
            } else {
                console.log('Skipping transaction not in current month:', t);
            }
        });
        
        console.log('Transactions grouped by day:', transactionsByDay);`;

// Replace the content
if (appJsContent.includes(targetContent)) {
    const updatedContent = appJsContent.replace(targetContent, newContent);
    
    // Create a backup first
    const backupPath = path.join(__dirname, 'app.js.bak');
    fs.writeFileSync(backupPath, appJsContent);
    console.log(`Backup created at: ${backupPath}`);
    
    // Write the updated content
    fs.writeFileSync(appJsPath, updatedContent);
    console.log('Calendar transaction display has been fixed!');
} else {
    console.error('Could not find the target content in app.js');
    console.log('The file may have been updated. Please check the file manually.');
    console.log('Here\'s the fix that needs to be applied:');
    console.log('\n' + '='.repeat(80));
    console.log(newContent);
    console.log('='.repeat(80));
}
