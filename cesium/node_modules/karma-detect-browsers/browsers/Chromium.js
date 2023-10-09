module.exports = {
    name: 'Chromium',
    DEFAULT_CMD: {
        linux: [
            // Try chromium-browser before chromium to avoid conflict with the legacy
            // chromium-bsu package previously known as 'chromium' in Debian and Ubuntu.
            'chromium-browser',
            'chromium',
        ],
        darwin: [
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ],
        win32: [
            process.env['ProgramFiles(x86)'] + '\\Chromium\\Application\\chrome.exe',
        ],
    },
    ENV_CMD: 'CHROMIUM_BIN'
};
