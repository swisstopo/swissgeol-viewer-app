module.exports = {
    name: 'Opera',
    DEFAULT_CMD: {
        linux: ['opera'],
        darwin: ['/Applications/Opera.app/Contents/MacOS/Opera'],
        win32: [
            process.env.LOCALAPPDATA + '\\Opera\\opera.exe',
            process.env.ProgramW6432 + '\\Opera\\opera.exe',
            process.env.ProgramFiles + '\\Opera\\opera.exe',
            process.env['ProgramFiles(x86)'] + '\\Opera\\opera.exe'
        ]
    },
    ENV_CMD: 'OPERA_BIN'
};