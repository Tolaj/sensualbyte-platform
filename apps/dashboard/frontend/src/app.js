import React, { useState, useEffect } from "react";
import { apiFetch, getUserRole } from "./api";


export default function App() {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");


    // USERS
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ email: "", password: "", role: "team" });


    // ENVIRONMENTS
    const [envs, setEnvs] = useState([]);


    const [error, setError] = useState("");
    const role = getUserRole();


    /* ---------------- functions ---------------- */


    async function assignEnv(envId, userId) {
        await apiFetch(`/environments/${envId}/assign`, {
            method: "POST",
            body: JSON.stringify({ userId })
        });
        loadEnvs();
    }

    async function unassignEnv(envId) {
        await apiFetch(`/environments/${envId}/unassign`, {
            method: "POST"
        });
        loadEnvs();
    }




    /* ---------------- AUTH ---------------- */


    async function login() {
        try {
            const res = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });
            localStorage.setItem("token", res.token);
            setToken(res.token);
        } catch (e) {
            console.log('-------------error------------', e)
            setError("Login failed");
        }
    }


    function logout() {
        localStorage.removeItem("token");
        setToken(null);
    }


    /* ---------------- USERS ---------------- */


    async function loadUsers() {
        try {
            const data = await apiFetch("/users");
            setUsers(data);
        } catch { }
    }


    async function createUser() {
        await apiFetch("/users", {
            method: "POST",
            body: JSON.stringify(newUser)
        });
        setNewUser({ email: "", password: "", role: "team" });
        loadUsers();
    }


    async function deleteUser(id) {
        await apiFetch(`/users/${id}`, { method: "DELETE" });
        loadUsers();
    }


    /* ---------------- ENVIRONMENTS ---------------- */


    async function loadEnvs() {
        try {
            const data = await apiFetch("/environments");
            setEnvs(data);
        } catch { }
    }


    async function createEnv() {
        await apiFetch("/environments", { method: "POST" });
        loadEnvs();
    }


    async function envAction(id, action) {
        await apiFetch(`/environments/${id}/${action}`, { method: "POST" });
        loadEnvs();
    }


    async function deleteEnv(id) {
        await apiFetch(`/environments/${id}`, { method: "DELETE" });
        loadEnvs();
    }


    /* ---------------- INIT ---------------- */


    useEffect(() => {
        if (token) {
            loadUsers();
            loadEnvs();
        }
    }, [token]);


    /* ---------------- UI ---------------- */


    if (!token) {
        return (
            <div style={{ padding: 40 }}>
                <h2>Login</h2>
                <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
                <br />
                <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
                <br />
                <button onClick={login}>Login</button>
                <p style={{ color: "red" }}>{error}</p>
            </div>
        );
    }

    const teamUsers = users.filter(u => u.role === "team");
    return (
        <div style={{ padding: 40 }}>
            <h2>Dashboard ({role})</h2>


            {/* USERS SECTION */}
            <h3>Users</h3>
            <ul>
                {users.map(u => (
                    <li key={u._id}>
                        {u.email} ({u.role})
                        {role === "super_admin" && (
                            <button onClick={() => deleteUser(u._id)}>Delete</button>
                        )}
                    </li>
                ))}
            </ul>


            {role === "super_admin" && (
                <>
                    <h4>Create User</h4>
                    <input
                        placeholder="Email"
                        value={newUser.email}
                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    />
                    <br />
                    <input
                        type="password"
                        placeholder="Password"
                        value={newUser.password}
                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <br />
                    <select
                        value={newUser.role}
                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    >
                        <option value="team">Team</option>
                        <option value="admin">Admin</option>
                    </select>
                    <br />
                    <button onClick={createUser}>Create User</button>
                </>
            )}


            <hr />


            {/* ENVIRONMENTS SECTION */}
            <h3>Environments</h3>


            {(role === "super_admin" || role === "admin") && (
                <button onClick={createEnv}>Create Environment</button>
            )}

            <ul>
                {envs.map(e => (
                    <li key={e.id}>
                        <b>{e.id}</b> — {e.status}


                        {/* ADMIN / SUPER ADMIN CONTROLS */}
                        {role !== "team" && (
                            <>
                                <button onClick={() => envAction(e.id, "start")}>Start</button>
                                <button onClick={() => envAction(e.id, "stop")}>Stop</button>
                                <button onClick={() => deleteEnv(e.id)}>Delete</button>


                                {/* ASSIGN TO TEAM */}
                                <select
                                    defaultValue=""
                                    onChange={ev => assignEnv(e.id, ev.target.value)}
                                >
                                    <option value="" disabled>
                                        Assign to team
                                    </option>
                                    {teamUsers.map(u => (
                                        <option key={u._id} value={u._id}>
                                            {u.email}
                                        </option>
                                    ))}
                                </select>


                                <button onClick={() => unassignEnv(e.id)}>Unassign</button>
                            </>
                        )}
                    </li>
                ))}
            </ul>



            <hr />


            <button onClick={logout}>Logout</button>
        </div>
    );
}





