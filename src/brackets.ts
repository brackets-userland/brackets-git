declare const brackets: {
    platform: string;
    getModule: (path: string) => any;
    fs: any;
};

declare const require: Function;

interface JQuery {
    tab: (cmd: string) => JQuery;
}

declare module "strings";
