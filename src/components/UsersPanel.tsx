"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";

type AppUser = {
  id: number;
  username: string;
  role: "admin" | "operator";
  createdAt: string;
};

export function UsersPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"operator" | "admin">("operator");
  const [status, setStatus] = useState("");

  async function load() {
    const response = await fetch("/api/users");
    const json = (await response.json()) as { users?: AppUser[]; error?: string };
    setUsers(json.users || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    const json = (await response.json()) as { users?: AppUser[]; error?: string };
    if (!response.ok) {
      setStatus(json.error || "Could not create user");
      return;
    }
    setUsers(json.users || []);
    setUsername("");
    setPassword("");
    setRole("operator");
    setStatus("User created");
  }

  async function remove(id: number) {
    const response = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { users?: AppUser[]; error?: string };
    if (!response.ok) {
      setStatus(json.error || "Could not delete user");
      return;
    }
    setUsers(json.users || []);
    setStatus("User deleted");
  }

  return (
    <Card
      title="App users"
      description="Operators can watch occupancy, history, and alerts. They cannot open Settings or the webhook log. Every signed-in action is written to the activity log."
    >
      <form onSubmit={create} className="mb-5 grid gap-4 sm:grid-cols-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "operator")}>
            <option value="operator">Operator — no Settings or webhook log</option>
            <option value="admin">Admin — full access</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit">Add user</Button>
        </div>
      </form>
      {status ? <p className="mb-4 text-sm text-text-2">{status}</p> : null}
      <ul className="divide-y divide-line rounded-[8px] border border-line">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{user.username}</p>
              <p className="text-xs text-text-2">{user.role === "admin" ? "Admin" : "Operator"}</p>
            </div>
            <Button type="button" variant="danger" onClick={() => void remove(user.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
