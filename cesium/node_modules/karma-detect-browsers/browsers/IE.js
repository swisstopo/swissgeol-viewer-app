module.exports = {
    name: 'IE',
    DEFAULT_CMD: {
        win32: [
            process.env.ProgramW6432 + '\\Internet Explorer\\iexplore.exe',
            process.env.ProgramFiles + '\\Internet Explorer\\iexplore.exe',
            process.env['ProgramFiles(x86)'] + '\\Internet Explorer\\iexplore.exe'
        ]
    },
    ENV_CMD: 'IE_BIN'
};