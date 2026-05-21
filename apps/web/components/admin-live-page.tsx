"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiClient,
  TOKEN_KEY,
  type AdminPermission,
  type AdminRole,
  type AdminUser,
  type AuditLog,
  type MasterDataRecord,
  type OfflinePinStatus,
  type SyncDevice,
} from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type AdminLivePageProps = {
  screen: Screen;
};

type AdminState = {
  auditLogs: AuditLog[];
  error: string | null;
  loading: boolean;
  locations: MasterDataRecord[];
  offlinePin: OfflinePinStatus | null;
  permissions: AdminPermission[];
  roles: AdminRole[];
  syncDevices: SyncDevice[];
  users: AdminUser[];
};

type AdminTab = "users" | "roles" | "devices" | "audit" | "offline-pin";

type UserForm = {
  active: boolean;
  email: string;
  fullName: string;
  id: string;
  locationIds: string[];
  roleId: string;
  username: string;
};

type AuditFilters = {
  action: string;
  dateFrom: string;
  dateTo: string;
  module: string;
  search: string;
};

type DeviceForm = {
  active: boolean;
  deviceCode: string;
  id: string;
  locationId: string;
  name: string;
  type: string;
};

const emptyUserForm: UserForm = {
  active: true,
  email: "",
  fullName: "",
  id: "",
  locationIds: [],
  roleId: "",
  username: "",
};

const emptyDeviceForm: DeviceForm = {
  active: true,
  deviceCode: "",
  id: "",
  locationId: "",
  name: "",
  type: "Tablet",
};

const auditPageSize = 15;
const emptyAuditFilters: AuditFilters = {
  action: "",
  dateFrom: "",
  dateTo: "",
  module: "",
  search: "",
};

export function AdminLivePage({ screen }: AdminLivePageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string[]>>({});
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [offlinePin, setOfflinePin] = useState("");
  const [offlinePinConfirm, setOfflinePinConfirm] = useState("");
  const [state, setState] = useState<AdminState>({
    auditLogs: [],
    error: null,
    loading: true,
    locations: [],
    offlinePin: null,
    permissions: [],
    roles: [],
    syncDevices: [],
    users: [],
  });
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(emptyDeviceForm);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setState((current) => ({
          ...current,
          error: "Sign in again to load admin settings.",
          loading: false,
        }));
        return;
      }

      try {
        const client = new ApiClient(token);
        const [
          users,
          roles,
          permissions,
          locations,
          auditLogs,
          syncDevices,
          offlinePinPolicy,
        ] = await Promise.all([
            client.adminUsers(),
            client.adminRoles(),
            client.adminPermissions(),
            client.masterData<MasterDataRecord>("locations"),
            client.auditLogs(),
            client.adminSyncDevices(),
            client.adminOfflinePin(),
          ]);

        if (!cancelled) {
          setState({
            auditLogs: auditLogs.data,
            error: null,
            loading: false,
            locations: locations.data.filter(
              (location) => location.active !== false,
            ),
            offlinePin: offlinePinPolicy,
            permissions: permissions.data,
            roles: roles.data,
            syncDevices: syncDevices.data,
            users: users.data,
          });
          setRoleDrafts(
            Object.fromEntries(
              roles.data.map((role) => [role.id, role.permissionIds]),
            ),
          );
          setSelectedRoleId(defaultRoleId(roles.data));
          setUserForm((current) => ({
            ...current,
            roleId: roles.data[0]?.id ?? "",
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load admin settings.",
            loading: false,
          }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => buildAdminKpis(state, state.loading), [state]);

  async function refresh(client: ApiClient) {
    const [users, roles, permissions, auditLogs, syncDevices, offlinePinPolicy] =
      await Promise.all([
        client.adminUsers(),
        client.adminRoles(),
        client.adminPermissions(),
        client.auditLogs(),
        client.adminSyncDevices(),
        client.adminOfflinePin(),
      ]);

    setState((current) => ({
      ...current,
      auditLogs: auditLogs.data,
      offlinePin: offlinePinPolicy,
      permissions: permissions.data,
      roles: roles.data,
      syncDevices: syncDevices.data,
      users: users.data,
    }));
    setRoleDrafts(
      Object.fromEntries(
        roles.data.map((role) => [role.id, role.permissionIds]),
      ),
    );
    setSelectedRoleId((current) =>
      roles.data.some((role) => role.id === current)
        ? current
        : defaultRoleId(roles.data),
    );
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const client = await clientFromSession();
      const payload = {
        email: userForm.email,
        username: userForm.username,
        fullName: userForm.fullName,
        roleId: userForm.roleId,
        active: userForm.active,
        locationIds: userForm.locationIds,
      };

      if (userForm.id) {
        await client.updateAdminUser(userForm.id, payload);
      } else {
        await client.createAdminUser(payload);
      }

      await refresh(client);
      setUserForm({ ...emptyUserForm, roleId: state.roles[0]?.id ?? "" });
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to save user.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateUser(id: string) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.deactivateAdminUser(id);
      await refresh(client);
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error ? error.message : "Unable to deactivate user.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(role: AdminRole) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.updateAdminRole(role.id, {
        name: role.name,
        description: role.description ?? undefined,
        permissionIds: roleDrafts[role.id] ?? [],
      });
      await refresh(client);
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error ? error.message : "Unable to update role.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function submitDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const client = await clientFromSession();
      const payload = {
        active: deviceForm.active,
        deviceCode: deviceForm.deviceCode,
        locationId: deviceForm.locationId || null,
        name: deviceForm.name,
        type: deviceForm.type || undefined,
      };

      if (deviceForm.id) {
        await client.updateAdminSyncDevice(deviceForm.id, payload);
      } else {
        await client.createAdminSyncDevice(payload);
      }

      await refresh(client);
      setDeviceForm(emptyDeviceForm);
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error ? error.message : "Unable to save device.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDevice(id: string) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.deactivateAdminSyncDevice(id);
      await refresh(client);
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to deactivate device.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function resetOfflinePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      if (offlinePin !== offlinePinConfirm) {
        throw new Error("Offline PIN confirmation does not match.");
      }

      const client = await clientFromSession();
      const policy = await client.resetAdminOfflinePin(offlinePin);

      setState((current) => ({
        ...current,
        error: null,
        offlinePin: policy,
      }));
      setOfflinePin("");
      setOfflinePinConfirm("");
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset offline PIN.",
      }));
    } finally {
      setSaving(false);
    }
  }

  function editUser(user: AdminUser) {
    setActiveTab("users");
    setUserForm({
      active: user.active,
      email: user.email,
      fullName: user.fullName,
      id: user.id,
      locationIds: user.locationIds,
      roleId: user.roleId,
      username: user.username,
    });
  }

  async function resetUserPassword(id: string) {
    await runUserAction(
      id,
      (client, userId) => client.resetAdminUserPassword(userId),
      "Unable to reset user password.",
    );
  }

  async function unrestrictUser(id: string) {
    await runUserAction(
      id,
      (client, userId) => client.unrestrictAdminUser(userId),
      "Unable to unrestrict user.",
    );
  }

  async function unlockUser(id: string) {
    await runUserAction(
      id,
      (client, userId) => client.unlockAdminUser(userId),
      "Unable to unlock user.",
    );
  }

  async function runUserAction(
    id: string,
    action: (client: ApiClient, userId: string) => Promise<AdminUser>,
    fallbackMessage: string,
  ) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      await action(client, id);
      await refresh(client);
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : fallbackMessage,
      }));
    } finally {
      setSaving(false);
    }
  }

  function editDevice(device: SyncDevice) {
    setActiveTab("devices");
    setDeviceForm({
      active: device.active ?? true,
      deviceCode: device.deviceCode,
      id: device.id,
      locationId: device.locationId ?? "",
      name: device.name,
      type: device.type ?? "",
    });
  }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-green-50 p-3 text-og-green">
            <Icon name={screen.icon} size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-og-gray">
              {screen.eyebrow}
            </p>
            <h1 className="font-poppins text-2xl font-semibold text-og-dark sm:text-[28px]">
              {screen.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-og-gray">
              {screen.description}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      {state.error ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-og-error">
          {state.error}
        </div>
      ) : null}

      <AdminTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "users" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <UserEditor
            disabled={state.loading || saving}
            form={userForm}
            locations={state.locations}
            roles={state.roles}
            setForm={setUserForm}
            submit={submitUser}
          />
          <UsersTable
            deactivateUser={deactivateUser}
            editUser={editUser}
            loading={state.loading}
            resetUserPassword={resetUserPassword}
            saving={saving}
            unrestrictUser={unrestrictUser}
            unlockUser={unlockUser}
            users={state.users}
          />
        </section>
      ) : null}

      {activeTab === "roles" ? (
        <RolesPanel
          disabled={state.loading || saving}
          permissions={state.permissions}
          roleDrafts={roleDrafts}
          roles={state.roles}
          saveRole={saveRole}
          selectedRoleId={selectedRoleId}
          setSelectedRoleId={setSelectedRoleId}
          setRoleDrafts={setRoleDrafts}
        />
      ) : null}

      {activeTab === "devices" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <DeviceEditor
            disabled={state.loading || saving}
            form={deviceForm}
            locations={state.locations}
            setForm={setDeviceForm}
            submit={submitDevice}
          />
          <DevicesTable
            deactivateDevice={deactivateDevice}
            devices={state.syncDevices}
            editDevice={editDevice}
            loading={state.loading}
            saving={saving}
          />
        </section>
      ) : null}

      {activeTab === "audit" ? (
        <AuditTable auditLogs={state.auditLogs} loading={state.loading} />
      ) : null}

      {activeTab === "offline-pin" ? (
        <OfflinePinPanel
          confirmValue={offlinePinConfirm}
          disabled={state.loading || saving}
          policy={state.offlinePin}
          setConfirmValue={setOfflinePinConfirm}
          setValue={setOfflinePin}
          submit={resetOfflinePin}
          value={offlinePin}
        />
      ) : null}
    </div>
  );
}

function AdminTabs({
  activeTab,
  onChange,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  return (
    <section className="inline-flex w-fit rounded-md border border-og-line bg-white p-1">
      {[
        { label: "Users", value: "users" },
        { label: "Roles", value: "roles" },
        { label: "Devices", value: "devices" },
        { label: "Audit Trail", value: "audit" },
        { label: "Offline PIN", value: "offline-pin" },
      ].map((tab) => (
        <button
          className={`rounded px-3 py-2 text-sm font-semibold transition ${
            activeTab === tab.value
              ? "bg-green-50 text-og-green"
              : "text-og-gray hover:text-og-dark"
          }`}
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value as AdminTab)}
        >
          {tab.label}
        </button>
      ))}
    </section>
  );
}

function UserEditor({
  disabled,
  form,
  locations,
  roles,
  setForm,
  submit,
}: {
  disabled: boolean;
  form: UserForm;
  locations: MasterDataRecord[];
  roles: AdminRole[];
  setForm: (form: UserForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [locationSearch, setLocationSearch] = useState("");
  const filteredLocations = useMemo(
    () => filterUserLocations(locations, locationSearch),
    [locations, locationSearch],
  );

  return (
    <form className="og-card flex flex-col gap-3" onSubmit={submit}>
      <div>
        <h2 className="font-poppins text-lg font-semibold text-og-dark">
          {form.id ? "Edit User" : "Create User"}
        </h2>
        <p className="mt-1 text-sm text-og-gray">
          Assign role and allowed locations for this account.
        </p>
      </div>

      <TextField
        disabled={disabled}
        label="Full name"
        value={form.fullName}
        onChange={(fullName) => setForm({ ...form, fullName })}
      />
      <TextField
        disabled={disabled}
        label="Email"
        type="email"
        value={form.email}
        onChange={(email) => setForm({ ...form, email })}
      />
      <TextField
        disabled={disabled}
        label="Username"
        value={form.username}
        onChange={(username) => setForm({ ...form, username })}
      />
      <p className="rounded-md border border-og-line bg-gray-50 px-3 py-2 text-xs font-semibold text-og-gray">
        New and reset accounts use the temporary password onegourmetfoodsinc.
      </p>

      <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
        Role
        <select
          className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
          disabled={disabled}
          required
          value={form.roleId}
          onChange={(event) => setForm({ ...form, roleId: event.target.value })}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="rounded-md border border-og-line p-3">
        <legend className="px-1 text-xs font-semibold text-og-gray">
          Location Access ({formatInteger(form.locationIds.length)} selected)
        </legend>
        <div className="grid gap-2 pt-1">
          <input
            className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
            disabled={disabled}
            placeholder="Search locations"
            value={locationSearch}
            onChange={(event) => setLocationSearch(event.target.value)}
          />
          <div className="grid max-h-48 gap-2 overflow-y-auto">
            {filteredLocations.length === 0 ? (
              <p className="py-4 text-center text-sm text-og-gray">
                No matching locations
              </p>
            ) : (
              filteredLocations.map((location) => {
                const id = text(location.id);
                const selected = form.locationIds.includes(id);

                return (
                  <label
                    className="flex items-center gap-2 text-sm font-medium text-og-dark"
                    key={id}
                  >
                    <input
                      checked={selected}
                      disabled={disabled}
                      type="checkbox"
                      onChange={(event) =>
                        setForm({
                          ...form,
                          locationIds: event.target.checked
                            ? [...form.locationIds, id]
                            : form.locationIds.filter(
                                (locationId) => locationId !== id,
                              ),
                        })
                      }
                    />
                    {text(location.code)} - {text(location.name)}
                  </label>
                );
              })
            )}
          </div>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-semibold text-og-dark">
        <input
          checked={form.active}
          disabled={disabled}
          type="checkbox"
          onChange={(event) =>
            setForm({ ...form, active: event.target.checked })
          }
        />
        Active
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          <Icon name="Save" size={18} />
          Save User
        </button>
        {form.id ? (
          <button
            className="inline-flex h-10 items-center rounded-md border border-og-line px-4 text-sm font-semibold text-og-gray"
            disabled={disabled}
            type="button"
            onClick={() =>
              setForm({ ...emptyUserForm, roleId: roles[0]?.id ?? "" })
            }
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}

function UsersTable({
  deactivateUser,
  editUser,
  loading,
  resetUserPassword,
  saving,
  unrestrictUser,
  unlockUser,
  users,
}: {
  deactivateUser: (id: string) => void;
  editUser: (user: AdminUser) => void;
  loading: boolean;
  resetUserPassword: (id: string) => void;
  saving: boolean;
  unrestrictUser: (id: string) => void;
  unlockUser: (id: string) => void;
  users: AdminUser[];
}) {
  return (
    <section className="og-card overflow-hidden p-0">
      <TableHeader count={users.length} icon="Users" title="Users" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["User", "Role", "Locations", "Status", "Actions"].map(
                (column) => (
                  <th className="og-table-header" key={column}>
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={5} message="Loading users" />
            ) : users.length === 0 ? (
              <EmptyRow colSpan={5} message="No users found" />
            ) : (
              users.map((user) => (
                <tr className="border-t border-og-line" key={user.id}>
                  <td className="og-table-cell">
                    <p className="font-semibold text-og-dark">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-og-gray">
                      {user.email} / {user.username}
                    </p>
                  </td>
                  <td className="og-table-cell">{user.roleName}</td>
                  <td className="og-table-cell">
                    {user.locations
                      .map((location) => location.code)
                      .join(", ") || "-"}
                  </td>
                  <td className="og-table-cell">
                    <div className="flex flex-col gap-1">
                      <StatusBadge value={user.accountStatus} />
                      {user.failedLoginCount > 0 ? (
                        <span className="text-xs text-og-gray">
                          Failed attempts: {user.failedLoginCount}/3
                        </span>
                      ) : null}
                      {user.restrictionCount > 0 ? (
                        <span className="text-xs text-og-gray">
                          Restrictions today: {user.restrictionCount}/3
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="og-table-cell">
                    <div className="flex flex-wrap gap-1">
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green"
                        disabled={saving}
                        type="button"
                        onClick={() => editUser(user)}
                      >
                        <Icon name="Pencil" size={16} />
                      </button>
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green disabled:opacity-50"
                        disabled={saving}
                        title="Reset password"
                        type="button"
                        onClick={() => resetUserPassword(user.id)}
                      >
                        <Icon name="KeyRound" size={16} />
                      </button>
                      {user.restrictedAt ? (
                        <button
                          className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green disabled:opacity-50"
                          disabled={saving || Boolean(user.lockedAt)}
                          title="Unrestrict account"
                          type="button"
                          onClick={() => unrestrictUser(user.id)}
                        >
                          <Icon name="ShieldCheck" size={16} />
                        </button>
                      ) : null}
                      {user.lockedAt ? (
                        <button
                          className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green disabled:opacity-50"
                          disabled={saving}
                          title="Unlock account"
                          type="button"
                          onClick={() => unlockUser(user.id)}
                        >
                          <Icon name="LockKeyhole" size={16} />
                        </button>
                      ) : null}
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-red-50 hover:text-og-error disabled:opacity-50"
                        disabled={saving || !user.active}
                        type="button"
                        onClick={() => deactivateUser(user.id)}
                      >
                        <Icon name="UserX" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeviceEditor({
  disabled,
  form,
  locations,
  setForm,
  submit,
}: {
  disabled: boolean;
  form: DeviceForm;
  locations: MasterDataRecord[];
  setForm: (form: DeviceForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="og-card flex flex-col gap-3" onSubmit={submit}>
      <div>
        <h2 className="font-poppins text-lg font-semibold text-og-dark">
          {form.id ? "Edit Device" : "Register Device"}
        </h2>
        <p className="mt-1 text-sm text-og-gray">
          Assign store tablets, laptops, or POS devices to a working location.
        </p>
      </div>

      <TextField
        disabled={disabled}
        label="Device code"
        value={form.deviceCode}
        onChange={(deviceCode) => setForm({ ...form, deviceCode })}
      />
      <TextField
        disabled={disabled}
        label="Device name"
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
      />
      <TextField
        disabled={disabled}
        label="Device type"
        required={false}
        value={form.type}
        onChange={(type) => setForm({ ...form, type })}
      />

      <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
        Assigned location
        <select
          className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
          disabled={disabled}
          value={form.locationId}
          onChange={(event) =>
            setForm({ ...form, locationId: event.target.value })
          }
        >
          <option value="">Unassigned / admin device</option>
          {locations.map((location) => (
            <option key={text(location.id)} value={text(location.id)}>
              {text(location.code)} - {text(location.name)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold text-og-dark">
        <input
          checked={form.active}
          disabled={disabled}
          type="checkbox"
          onChange={(event) =>
            setForm({ ...form, active: event.target.checked })
          }
        />
        Active
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          <Icon name="Save" size={18} />
          Save Device
        </button>
        {form.id ? (
          <button
            className="inline-flex h-10 items-center rounded-md border border-og-line px-4 text-sm font-semibold text-og-gray"
            disabled={disabled}
            type="button"
            onClick={() => setForm(emptyDeviceForm)}
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}

function DevicesTable({
  deactivateDevice,
  devices,
  editDevice,
  loading,
  saving,
}: {
  deactivateDevice: (id: string) => void;
  devices: SyncDevice[];
  editDevice: (device: SyncDevice) => void;
  loading: boolean;
  saving: boolean;
}) {
  return (
    <section className="og-card overflow-hidden p-0">
      <TableHeader count={devices.length} icon="Wifi" title="Devices" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Device", "Location", "Last Seen", "Status", "Actions"].map(
                (column) => (
                  <th className="og-table-header" key={column}>
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={5} message="Loading devices" />
            ) : devices.length === 0 ? (
              <EmptyRow colSpan={5} message="No devices registered" />
            ) : (
              devices.map((device) => (
                <tr className="border-t border-og-line" key={device.id}>
                  <td className="og-table-cell">
                    <p className="font-semibold text-og-dark">
                      {device.deviceCode}
                    </p>
                    <p className="text-xs text-og-gray">
                      {device.name}
                      {device.type ? ` / ${device.type}` : ""}
                    </p>
                  </td>
                  <td className="og-table-cell">
                    {device.location
                      ? `${device.location.code} - ${device.location.name}`
                      : "Unassigned"}
                  </td>
                  <td className="og-table-cell">
                    {device.lastSeenAt
                      ? formatDateTime(device.lastSeenAt)
                      : "-"}
                  </td>
                  <td className="og-table-cell">
                    <StatusBadge
                      value={device.active ? "Active" : "Inactive"}
                    />
                  </td>
                  <td className="og-table-cell">
                    <div className="flex gap-1">
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-green-50 hover:text-og-green"
                        disabled={saving}
                        type="button"
                        onClick={() => editDevice(device)}
                      >
                        <Icon name="Pencil" size={16} />
                      </button>
                      <button
                        className="rounded-md p-2 text-og-gray hover:bg-red-50 hover:text-og-error disabled:opacity-50"
                        disabled={saving || !device.active}
                        type="button"
                        onClick={() => deactivateDevice(device.id)}
                      >
                        <Icon name="X" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RolesPanel({
  disabled,
  permissions,
  roleDrafts,
  roles,
  saveRole,
  selectedRoleId,
  setSelectedRoleId,
  setRoleDrafts,
}: {
  disabled: boolean;
  permissions: AdminPermission[];
  roleDrafts: Record<string, string[]>;
  roles: AdminRole[];
  saveRole: (role: AdminRole) => void;
  selectedRoleId: string;
  setSelectedRoleId: (roleId: string) => void;
  setRoleDrafts: (drafts: Record<string, string[]>) => void;
}) {
  const permissionsByModule = groupPermissions(permissions);
  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0];

  return (
    <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="og-card flex flex-col gap-3 p-0">
        <div className="border-b border-og-line p-4">
          <h2 className="font-poppins text-lg font-semibold text-og-dark">
            Available Roles
          </h2>
          <p className="mt-1 text-sm text-og-gray">
            Select a role to maintain its access.
          </p>
        </div>
        <div className="grid gap-1 p-2">
          {roles.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-og-gray">
              No roles found
            </p>
          ) : (
            roles.map((role) => (
              <button
                className={`rounded-md border px-3 py-3 text-left transition ${
                  selectedRole?.id === role.id
                    ? "border-og-green bg-green-50 text-og-green"
                    : "border-transparent text-og-dark hover:border-og-line hover:bg-gray-50"
                }`}
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
              >
                <span className="block text-sm font-semibold">{role.name}</span>
                <span className="mt-1 block text-xs font-semibold uppercase text-og-gray">
                  {role.code} / {formatInteger(role.userCount)} users
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {selectedRole ? (
        <div className="og-card flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-poppins text-lg font-semibold text-og-dark">
                {selectedRole.name}
              </h2>
              <p className="text-xs font-semibold uppercase text-og-gray">
                {selectedRole.code} / {formatInteger(selectedRole.userCount)}{" "}
                users
              </p>
              {selectedRole.description ? (
                <p className="mt-1 text-sm text-og-gray">
                  {selectedRole.description}
                </p>
              ) : null}
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md bg-og-green px-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={disabled}
              type="button"
              onClick={() => saveRole(selectedRole)}
            >
              <Icon name="Save" size={16} />
              Save Access
            </button>
          </div>

          <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1">
            {Object.entries(permissionsByModule).map(
              ([module, modulePermissions]) => (
                <fieldset
                  className="rounded-md border border-og-line p-3"
                  key={module}
                >
                  <legend className="px-1 text-xs font-semibold uppercase text-og-gray">
                    {module}
                  </legend>
                  <div className="grid gap-2 pt-1">
                    {modulePermissions.map((permission) => {
                      const selected = (
                        roleDrafts[selectedRole.id] ?? []
                      ).includes(permission.id);

                      return (
                        <label
                          className="flex items-start gap-2 text-sm text-og-dark"
                          key={permission.id}
                        >
                          <input
                            checked={selected}
                            disabled={disabled}
                            type="checkbox"
                            onChange={(event) => {
                              const current = roleDrafts[selectedRole.id] ?? [];
                              setRoleDrafts({
                                ...roleDrafts,
                                [selectedRole.id]: event.target.checked
                                  ? [...current, permission.id]
                                  : current.filter(
                                      (id) => id !== permission.id,
                                    ),
                              });
                            }}
                          />
                          <span>
                            <span className="font-semibold">
                              {permission.action}
                            </span>
                            {permission.description ? (
                              <span className="block text-xs text-og-gray">
                                {permission.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ),
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OfflinePinPanel({
  confirmValue,
  disabled,
  policy,
  setConfirmValue,
  setValue,
  submit,
  value,
}: {
  confirmValue: string;
  disabled: boolean;
  policy: OfflinePinStatus | null;
  setConfirmValue: (value: string) => void;
  setValue: (value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form className="og-card flex flex-col gap-3" onSubmit={submit}>
        <div>
          <h2 className="font-poppins text-lg font-semibold text-og-dark">
            Reset Offline PIN
          </h2>
          <p className="mt-1 text-sm text-og-gray">
            This PIN applies to every location. The actual PIN is never shown
            after saving.
          </p>
        </div>

        <TextField
          disabled={disabled}
          label="New offline PIN"
          type="password"
          value={value}
          onChange={setValue}
        />
        <TextField
          disabled={disabled}
          label="Confirm offline PIN"
          type="password"
          value={confirmValue}
          onChange={setConfirmValue}
        />

        <button
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          type="submit"
        >
          <Icon name="LockKeyhole" size={18} />
          Reset PIN
        </button>
      </form>

      <section className="og-card overflow-hidden p-0">
        <TableHeader
          count={policy?.configured ? 1 : 0}
          icon="LockKeyhole"
          title="Offline PIN Policy"
        />
        <div className="grid gap-4 p-4">
          <div className="rounded-md border border-og-line p-4">
            <p className="text-xs font-semibold uppercase text-og-gray">
              Status
            </p>
            <div className="mt-2">
              <StatusBadge
                value={policy?.configured ? "Active" : "Inactive"}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-og-line p-4">
              <p className="text-xs font-semibold uppercase text-og-gray">
                Last Reset
              </p>
              <p className="mt-1 text-sm font-semibold text-og-dark">
                {policy?.updatedAt ? formatDateTime(policy.updatedAt) : "-"}
              </p>
            </div>
            <div className="rounded-md border border-og-line p-4">
              <p className="text-xs font-semibold uppercase text-og-gray">
                Reset By
              </p>
              <p className="mt-1 text-sm font-semibold text-og-dark">
                {policy?.updatedByName ?? "-"}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-og-gray">
            Users register this admin-managed PIN once per browser while online.
            After registration, the same PIN unlocks that browser&apos;s encrypted
            offline cache.
          </p>
        </div>
      </section>
    </section>
  );
}

function AuditTable({
  auditLogs,
  loading,
}: {
  auditLogs: AuditLog[];
  loading: boolean;
}) {
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters);
  const [page, setPage] = useState(1);
  const moduleOptions = useMemo(
    () => uniqueAuditOptions(auditLogs.map((log) => log.module)),
    [auditLogs],
  );
  const actionOptions = useMemo(
    () => uniqueAuditOptions(auditLogs.map((log) => log.action)),
    [auditLogs],
  );
  const filteredLogs = useMemo(
    () => filterAuditLogs(auditLogs, filters),
    [auditLogs, filters],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / auditPageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleLogs = filteredLogs.slice(
    (currentPage - 1) * auditPageSize,
    currentPage * auditPageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <section className="og-card overflow-hidden p-0">
      <TableHeader
        count={filteredLogs.length}
        icon="ShieldCheck"
        title="Audit Trail"
      />
      <div className="grid gap-3 border-b border-og-line p-4 lg:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(140px,1fr))_auto]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
          Search
          <input
            className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
            placeholder="User, action, entity"
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
          Module
          <select
            className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
            value={filters.module}
            onChange={(event) =>
              setFilters({ ...filters, module: event.target.value })
            }
          >
            <option value="">All</option>
            {moduleOptions.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
          Action
          <select
            className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
            value={filters.action}
            onChange={(event) =>
              setFilters({ ...filters, action: event.target.value })
            }
          >
            <option value="">All</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
          From
          <input
            className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters({ ...filters, dateFrom: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
          To
          <input
            className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters({ ...filters, dateTo: event.target.value })
            }
          />
        </label>
        <div className="flex items-end">
          <button
            className="h-10 rounded-md border border-og-line px-4 text-sm font-semibold text-og-gray disabled:opacity-50"
            disabled={
              !filters.search &&
              !filters.module &&
              !filters.action &&
              !filters.dateFrom &&
              !filters.dateTo
            }
            type="button"
            onClick={() => setFilters(emptyAuditFilters)}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Date", "User", "Module", "Action", "Entity"].map((column) => (
                <th className="og-table-header" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={5} message="Loading audit logs" />
            ) : filteredLogs.length === 0 ? (
              <EmptyRow colSpan={5} message="No audit logs found" />
            ) : (
              visibleLogs.map((log) => (
                <tr className="border-t border-og-line" key={log.id}>
                  <td className="og-table-cell">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="og-table-cell">{log.userName}</td>
                  <td className="og-table-cell">{log.module}</td>
                  <td className="og-table-cell">{log.action}</td>
                  <td className="og-table-cell">
                    {log.entityType ?? "-"} {log.entityId?.slice(0, 8) ?? ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-og-line px-4 py-3 text-sm text-og-gray sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing{" "}
          {visibleLogs.length === 0 ? 0 : (currentPage - 1) * auditPageSize + 1}
          {" - "}
          {Math.min(currentPage * auditPageSize, filteredLogs.length)} of{" "}
          {formatInteger(filteredLogs.length)}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="h-9 rounded-md border border-og-line px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentPage === 1}
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span className="font-semibold text-og-dark">
            Page {formatInteger(currentPage)} of {formatInteger(totalPages)}
          </span>
          <button
            className="h-9 rounded-md border border-og-line px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentPage === totalPages}
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr className="border-t border-og-line">
      <td
        className="og-table-cell py-8 text-center text-og-gray"
        colSpan={colSpan}
      >
        {message}
      </td>
    </tr>
  );
}

function TableHeader({
  count,
  icon,
  title,
}: {
  count: number;
  icon: "LockKeyhole" | "ShieldCheck" | "Users" | "Wifi";
  title: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-og-line p-4">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={20} className="text-og-green" />
        <h2 className="font-poppins text-xl font-semibold text-og-dark">
          {title}
        </h2>
      </div>
      <span className="text-xs font-semibold text-og-gray">
        {formatInteger(count)} records
      </span>
    </div>
  );
}

function TextField({
  disabled,
  label,
  required = true,
  type = "text",
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  required?: boolean;
  type?: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
      {label}
      <input
        className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
        disabled={disabled}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

async function clientFromSession() {
  const token = window.localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  return new ApiClient(token);
}

function buildAdminKpis(state: AdminState, loading: boolean): Kpi[] {
  const activeUsers = state.users.filter((user) => user.active).length;

  return [
    {
      label: "Active Users",
      value: loading ? "..." : formatInteger(activeUsers),
      meta: "Can sign in",
      icon: "Users",
      tone: "info",
    },
    {
      label: "Roles",
      value: loading ? "..." : formatInteger(state.roles.length),
      meta: "Permission groups",
      icon: "KeyRound",
      tone: "success",
    },
    {
      label: "Audit Logs",
      value: loading ? "..." : formatInteger(state.auditLogs.length),
      meta: "Latest admin/system events",
      icon: "ShieldCheck",
      tone: "neutral",
    },
  ];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function groupPermissions(permissions: AdminPermission[]) {
  return permissions.reduce<Record<string, AdminPermission[]>>(
    (groups, permission) => {
      groups[permission.module] = groups[permission.module] ?? [];
      groups[permission.module].push(permission);
      return groups;
    },
    {},
  );
}

function filterAuditLogs(auditLogs: AuditLog[], filters: AuditFilters) {
  const search = filters.search.trim().toLowerCase();

  return auditLogs.filter((log) => {
    const createdDate = log.createdAt.slice(0, 10);
    const searchText = [
      log.action,
      log.entityId,
      log.entityType,
      log.module,
      log.userName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!search || searchText.includes(search)) &&
      (!filters.module || log.module === filters.module) &&
      (!filters.action || log.action === filters.action) &&
      (!filters.dateFrom || createdDate >= filters.dateFrom) &&
      (!filters.dateTo || createdDate <= filters.dateTo)
    );
  });
}

function filterUserLocations(
  locations: MasterDataRecord[],
  locationSearch: string,
) {
  const search = locationSearch.trim().toLowerCase();

  if (!search) {
    return locations;
  }

  return locations.filter((location) =>
    [location.code, location.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search),
  );
}

function uniqueAuditOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function defaultRoleId(roles: AdminRole[]) {
  return roles.find((role) => role.code === "ADMIN")?.id ?? roles[0]?.id ?? "";
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
