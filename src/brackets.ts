declare const brackets: {
    platform: string;
    getLocale: () => string;
    getModule: (path: string) => any;
    fs: any;
};

declare const require: Function;

interface JQuery {
    andSelf: () => JQuery;
    tab: (cmd: string) => JQuery;
}

declare module "strings";
