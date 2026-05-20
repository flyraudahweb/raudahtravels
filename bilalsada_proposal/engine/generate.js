const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const rootPath = path.resolve(__dirname, '..');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    // Load the HTML file
    await page.goto('file://' + path.join(rootPath, 'proposal.html').replace(/\\/g, '/'), {
        waitUntil: 'networkidle0',
    });

    // Wait a bit to ensure window.onload completes, DOM is mutated, and Tailwind parses it
    await new Promise(r => setTimeout(r, 2000));

    // Save the rendered DOM
    const html = await page.content();
    fs.writeFileSync(path.join(rootPath, 'rendered_dom.html'), html);

    // Save as PDF
    await page.pdf({
        path: path.join(rootPath, 'BILALSADASUB_Enterprise_Proposal.pdf'),
        format: 'A4',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    await browser.close();
    console.log("PDF generation complete!");
})();
