const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { API_PORT, CORS_ORIGIN } = require("./config");

const health = require("./routes/health");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const appsRoutes = require("./routes/apps");
const envRoutes = require("./routes/environments");
const teamRoutes = require("./routes/teams");
const projectRoutes = require("./routes/projects");


const app = express();

app.use(cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.use("/api/health", health);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/apps", appsRoutes);
app.use("/api/environments", envRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/projects", projectRoutes);

app.listen(API_PORT, () => {
    console.log(`✅ API listening on :${API_PORT}`);
});
