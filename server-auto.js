const express = require('express');
const mysql = require('mysql2');
const fs = require('fs');
const csv = require('csv-parser');
const { exec } = require('child_process');
const schedule = require('node-schedule');

const app = express();
const PORT = 3000;

// Global error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// MySQL connection configuration
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mypass',
    database: 'TheTeam_DBTables'
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Database connection error:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

// Function to run the web scraper
function runWebScraper(callback) {
    exec('node C:\\Users\\truon\\red-rater\\scrape-2.0.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing scraper: ${error.message}`);
            return callback(error);
        }
        console.log('Scraper executed successfully');
        callback(null);
    });
}

// Function to read CSV and insert data into MySQL
function importCSVtoDatabase() {
    return new Promise((resolve, reject) => {
        const queryPromises = [];

        fs.createReadStream('result.csv')
            .pipe(csv())
            .on('data', (row) => {
                if (row.Name === 'Name' || row.Course === 'SubjectName') {
                    console.log('Skipping header row:', row);
                    return;
                }

                const sql = `
                    INSERT INTO course_evaluations (
                      term, instructor_name, subject, course_num, section, 
                      response_text, average, strongly_agree, agree, 
                      neutral, disagree, strongly_disagree, no_answer
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                const values = [
                    row.Term || 'Unknown Term',
                    row.Name || 'Unknown Instructor',
                    row.Course || 'Unknown Subject',
                    row['Course Num'] || 'Unknown Course Number',
                    row.Section || 'Unknown Section',
                    row.Response || '',
                    parseFloat(row.Average) || 0.0,
                    parseInt(row['Strongly Agree'], 10) || 0,
                    parseInt(row.Agree, 10) || 0,
                    parseInt(row.Neutral, 10) || 0,
                    parseInt(row.Disagree, 10) || 0,
                    parseInt(row['Strongly Disagree'], 10) || 0,
                    parseInt(row['No Answer'], 10) || 0
                ];

                queryPromises.push(
                    new Promise((resolve, reject) => {
                        db.query(sql, values, (err, result) => {
                            if (err) {
                                console.error('Insert error:', err);
                                return reject(err);
                            }
                            resolve(result);
                        });
                    })
                );
            })
            .on('end', async () => {
                try {
                    await Promise.all(queryPromises);
                    console.log('CSV file successfully processed and data inserted.');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
    });
}

// Function to automate the entire process
function automateScraper() {
    console.log('Starting automated scraper...');
    runWebScraper((error) => {
        if (error) {
            console.error('Error running the web scraper:', error);
            return;
        }

        importCSVtoDatabase()
            .then(() => {
                console.log('Data scraping and import completed successfully.');
            })
            .catch((err) => {
                console.error('Data import error:', err);
            });
    });
}

// Schedule the scraper to run every 3 months
try {
    schedule.scheduleJob('0 0 1 */3 *', () => { // Runs at midnight on the first day of every third month
        console.log('Running scheduled scraper...');
        automateScraper();
    });
} catch (error) {
    console.error('Error setting up schedule:', error);
}

// Endpoint to manually trigger the process
app.get('/run-scraper', (req, res) => {
    automateScraper();
    res.send('Scraper process started manually.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
