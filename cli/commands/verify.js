const path = require("path");
const { run } = require("../utils/exec");

module.exports = () => {
    const script = path.resolve(__dirname, "../../scripts/verify.sh");
    run(script);
};
