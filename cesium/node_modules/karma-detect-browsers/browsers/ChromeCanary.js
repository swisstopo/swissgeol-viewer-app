module.exports = {
    name: 'ChromeCanary',
    DEFAULT_CMD: {
        linux: ['google-chrome-canary'],
        darwin: ['/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'],
        win32: [
            process.env.LOCALAPPDATA + '\\Google\\Chrome SxS\\Application\\chrome.exe',
            process.env.ProgramW6432 + '\\Google\\Chrome SxS\\Application\\chrome.exe',
            process.env.ProgramFiles + '\\Google\\Chrome SxS\\Application\\chrome.exe',
            process.env['ProgramFiles(x86)'] + '\\Google\\Chrome SxS\\Application\\chrome.exe'
        ]
    },
    ENV_CMD: 'CHROME_CANARY_BIN'
};