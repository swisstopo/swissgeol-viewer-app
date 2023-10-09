module.exports = {
    name: 'FirefoxAurora',
    DEFAULT_CMD: {
        linux: ['firefox'],
        darwin: ['/Applications/FirefoxAurora.app/Contents/MacOS/firefox-bin'],
        win32: [
            process.env.LOCALAPPDATA + '\\Aurora\\firefox.exe',
            process.env.ProgramW6432 + '\\Aurora\\firefox.exe',
            process.env.ProgramFiles + '\\Aurora\\firefox.exe',
            process.env['ProgramFiles(x86)'] + '\\Aurora\\firefox.exe'
        ]
    },
    ENV_CMD: 'FIREFOX_AURORA_BIN'
};