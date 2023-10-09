module.exports = {
    name: 'Safari',
    DEFAULT_CMD: {
        darwin: ['/Applications/Safari.app/Contents/MacOS/Safari'],
        win32: [
            process.env.LOCALAPPDATA + '\\Safari\\Safari.exe',
            process.env.ProgramW6432 + '\\Safari\\Safari.exe',
            process.env.ProgramFiles + '\\Safari\\Safari.exe',
            process.env['ProgramFiles(x86)'] + '\\Safari\\Safari.exe'
        ]
    },
    ENV_CMD: 'SAFARI_BIN'
};