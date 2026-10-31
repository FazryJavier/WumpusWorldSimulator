/** Galat engine untuk konfigurasi tidak sah (aksi tidak sah TIDAK melempar galat). */
export class EngineError extends Error {
    /**
     * @param {"INVALID_CONFIG"|"INVALID_SEED"|"LEVEL_GENERATION_FAILED"} code
     * @param {string} message
     * @param {string[]} [details]
     */
    constructor(code, message, details = []) {
        super(message);
        this.name = "EngineError";
        this.code = code;
        this.details = details;
    }
}
