module.exports = {
    name: 'Firefox',
    DEFAULT_CMD: {
        linux: ['firefox'],
        darwin: ['/Applications/Firefox.app/Contents/MacOS/firefox-bin'],
        win32: [
            process.env.LOCALAPPDATA + '\\Mozilla Firefox\\firefox.exe',
            process.env.ProgramW6432 + '\\Mozilla Firefox\\firefox.exe',
            process.env.ProgramFiles + '\\Mozilla Firefox\\firefox.exe',
            process.env['ProgramFiles(x86)'] + '\\Mozilla Firefox\\firefox.exe'
        ]
    },
    ENV_CMD: 'FIREFOX_BIN'
};