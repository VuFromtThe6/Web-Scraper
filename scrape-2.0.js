const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://appserv.itts.ttu.edu/evaluations/main.aspx');
  await page.click('#btnNext'); 

  // Step 1: Get all available terms
  await page.waitForSelector('select#cboTerm');
  await page.click('select#cboTerm');
  const terms = await page.$$eval('select#cboTerm option', options => 
    options
      .filter(option => option.value && option.text !== '-- Select Term --') // Filter out unwanted options
      .map(option => option.value)
  );

  let allData = []; // Store data for all terms

  // Loop through each term
  for (const term of terms) {
    await page.waitForSelector('select#cboTerm');
    await page.click('select#cboTerm');
    await page.selectOption('select#cboTerm', term);
    await page.click('input#btnNext');

    // Step 2: Select the college
    await page.waitForSelector('select#cboCollege');
    await page.click('select#cboCollege');
    await page.selectOption('select#cboCollege', 'COLLEGE OF ENGINEERING');
    await page.click('input#btnNext');

    // Step 3: Select the department
    await page.waitForSelector('select#cboDepartment');
    await page.click('select#cboDepartment');
    
    const departmentOptions = await page.$$eval('select#cboDepartment option', options => options.map(option => option.text));
    if (!departmentOptions.includes('COMPUTER SCIENCE')) {
      console.log(`Skipping term ${term} as "Computer Science" department is unavailable.`);
      await page.click('select#cboDepartment');
      await page.click('input#btnBack'); // Return to college selection if department is not available
      await page.click('input#btnBack'); // Return to term selection
      continue;
    }

    await page.click('select#cboDepartment');
    await page.selectOption('select#cboDepartment', 'COMPUTER SCIENCE');
    await page.click('input#btnNext');

    // Step 4: Select the faculty
    await page.waitForSelector('select#cboMain');
    await page.click('select#cboMain');
    await page.selectOption('select#cboMain', '*ALL FACULTY');
    await page.click('input#btnSubmit');

    // Step 5: Scrape the results
    await page.waitForSelector('#dg'); // Wait for the table to load
    const data = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#dg tr'));
      return rows.map(row => {
        const columns = row.querySelectorAll('td');
        if (columns.length > 11) { // Ensure enough columns exist
          return {
            name:               columns[0].innerText.trim(),
            course:             columns[1].innerText.trim(),
            course_num:         columns[2].innerText.trim(),
            section:            columns[3].innerText.trim(),
            response:           columns[4].innerText.trim(),
            average:            columns[5].innerText.trim(),
            strong_agree:       columns[6].innerText.trim(),
            agree:              columns[7].innerText.trim(),
            neutral:            columns[8].innerText.trim(),
            disagree:           columns[9].innerText.trim(),
            strong_disagree:    columns[10].innerText.trim(),
            no_ans:             columns[11].innerText.trim(),
          };
        }
        return null;
      }).filter(row => row !== null);
    });

    // Add term info to each row
    data.forEach(row => {
      row.term = term;
    });

    allData.push(...data); // Append scraped data to allData

    // Go back to the term selection page to proceed to the next term
    await page.click('input#Mrerouter2_btnFootTerm');
  }

  // Write all collected data to CSV
  const createCsvWriter = require('csv-writer').createObjectCsvWriter;
  const csvWriter = createCsvWriter({
  path: 'result.csv',
  header: [
    { id: 'term', title: 'Term' },
    { id: 'name', title: 'Name' },
    { id: 'course', title: 'Course' },
    { id: 'course_num', title: 'Course Num' },
    { id: 'section', title: 'Section' },
    { id: 'response', title: 'Response' },
    { id: 'average', title: 'Average' },
    { id: 'strong_agree', title: 'Strongly Agree' },
    { id: 'agree', title: 'Agree' },
    { id: 'neutral', title: 'Neutral' },
    { id: 'disagree', title: 'Disagree' },
    { id: 'strong_disagree', title: 'Strongly Disagree' },
    { id: 'no_ans', title: 'No Answer' },
  ]
});

csvWriter.writeRecords(allData)
  .then(() => console.log('CSV file written successfully'));

  await browser.close();
})();
