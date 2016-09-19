class ExpectedError extends Error {

    constructor(message: string) {
        super(message);
        this.name = "ExpectedError";
        this.message = message;
    }

    public toString() {
        return this.name + ": " + this.message;
    }

}

export default ExpectedError;
