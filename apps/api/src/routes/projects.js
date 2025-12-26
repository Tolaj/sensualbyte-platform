const router = require("express").Router();
const { nanoid } = require("nanoid");

const { requireAuth } = require("../middleware/authMiddleware");
const { createProject, getProject, listProjectsByTeam } = require("../projects");
const { isTeamMember } = require("../teams");

/**
 * CREATE PROJECT
 */
router.post("/", requireAuth(["super_admin", "admin"]), (req, res) => {
    const { name, teamId } = req.body || {};
    if (!name || !teamId) {
        return res.status(400).json({ error: "name and teamId required" });
    }

    if (!isTeamMember(req.user.id, teamId) && req.user.role !== "super_admin") {
        return res.status(403).json({ error: "not a team member" });
    }

    const project = createProject({
        id: `proj_${nanoid(8)}`,
        name: name.trim(),
        teamId,
        userId: req.user.id
    });

    res.json(project);
});

/**
 * GET PROJECT
 */
router.get("/:id", requireAuth(["super_admin", "admin", "team"]), (req, res) => {
    const project = getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "not found" });

    if (!isTeamMember(req.user.id, project.teamId) && req.user.role !== "super_admin") {
        return res.status(403).json({ error: "forbidden" });
    }

    res.json(project);
});

/**
 * LIST PROJECTS FOR A TEAM
 */
router.get("/team/:teamId", requireAuth(["super_admin", "admin", "team"]), (req, res) => {
    if (!isTeamMember(req.user.id, req.params.teamId) && req.user.role !== "super_admin") {
        return res.status(403).json({ error: "forbidden" });
    }

    const projects = listProjectsByTeam(req.params.teamId);
    res.json(projects);
});

module.exports = router;
