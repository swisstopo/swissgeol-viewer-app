module.exports = {
    name: 'FirefoxNightly',
    DEFAULT_CMD: {
        linux: ['firefox'],
        darwin: ['/Applications/FirefoxNightly.app/Contents/MacOS/firefox-bin'],
        win32: [
            process.env.LOCALAPPDATA + '\\Nightly\\firefox.exe',
            process.env.ProgramW6432 + '\\Nightly\\firefox.exe',
            process.env.ProgramFiles + '\\Nightly\\firefox.exe',
            process.env['ProgramFiles(x86)'] + '\\Nightly\\firefox.exe'
        ]
    },
    ENV_CMD: 'FIREFOX_NIGHTLY_BIN'
};