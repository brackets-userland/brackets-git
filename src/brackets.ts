declare const brackets: {
    platform: string;
    getModule: (path: string) => any;
    fs: any;
};

interface JQuery {
    tab: (cmd: string) => JQuery;
}
