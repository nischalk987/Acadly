import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Download,
  FileJson,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const EXPORT_TABLES = [
  "subjects",
  "chapters",
  "study_tasks",
  "exams",
  "study_sessions",
  "notes",
  "revisions",
  "reminders",
];

function getTimeZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [
      "Asia/Kolkata",
      "Asia/Dubai",
      "Asia/Singapore",
      "Europe/London",
      "Europe/Berlin",
      "America/New_York",
      "America/Los_Angeles",
      "Australia/Sydney",
      "UTC",
    ];
  }
}

function avatarInitial(name, email) {
  return (name || email || "S").trim().charAt(0).toUpperCase();
}

function SettingsMessage({ kind, children }) {
  if (!children) return null;
  return <p className={\`settings-message settings-message-\${kind}\`} role={kind === "error" ? "alert" : "status"}>{children}</p>;
}

export function ProfileSettings({ session, onDisplayNameChange, onSignOut }) {
  const userId = session?.user?.id;
  const email = session?.user?.email || "";
  const timeZones = useMemo(getTimeZones, []);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      if (!userId || !supabase) return;
      setLoading(true);
      setError("");
      try {
        const [profileResult, preferencesResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase.from("user_preferences").select("*").eq("user_id", userId).single(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (preferencesResult.error) throw preferencesResult.error;
        if (!active) return;

        const nextProfile = profileResult.data;
        setProfile(nextProfile);
        setPreferences(preferencesResult.data);
        setDisplayName(nextProfile.display_name || "");
        setTimezone(nextProfile.timezone || "Asia/Kolkata");
        setWeekStartsOn(Number(nextProfile.week_starts_on ?? 1));

        if (nextProfile.avatar_path) {
          const { data, error: avatarError } = await supabase.storage
            .from("student-avatars")
            .createSignedUrl(nextProfile.avatar_path, 3600);
          if (avatarError) throw avatarError;
          if (active) setAvatarUrl(data.signedUrl);
        } else {
          setAvatarUrl("");
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load your account settings.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSettings();
    return () => { active = false; };
  }, [userId]);

  async function saveSettings(event) {
    event.preventDefault();
    if (!supabase || !userId) return;
    const cleanName = displayName.trim();
    if (!cleanName) {
      setError("Display name cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: savedProfile, error: profileError } = await supabase.from("profiles")
        .update({
          display_name: cleanName,
          timezone,
          week_starts_on: Number(weekStartsOn),
        })
        .eq("id", userId)
        .select()
        .single();
      if (profileError) throw profileError;

      setProfile(savedProfile);
      onDisplayNameChange?.(cleanName);
      setNotice("Your profile and preferences have been saved.");
    } catch (saveError) {
      setError(saveError.message || "Could not save your settings.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !userId) return;

    const acceptedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!acceptedTypes.includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar images must be 2 MB or smaller.");
      return;
    }

    setAvatarBusy(true);
    setError("");
    setNotice("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const newPath = \`\${userId}/\${crypto.randomUUID()}.\${extension}\`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("student-avatars")
        .upload(newPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from("profiles")
        .update({ avatar_path: newPath }).eq("id", userId);
      if (updateError) {
        await supabase.storage.from("student-avatars").remove([newPath]);
        throw updateError;
      }

      if (profile?.avatar_path) {
        await supabase.storage.from("student-avatars").remove([profile.avatar_path]);
      }
      const { data, error: signedUrlError } = await supabase.storage
        .from("student-avatars")
        .createSignedUrl(newPath, 3600);
      if (signedUrlError) throw signedUrlError;

      setProfile((current) => ({ ...current, avatar_path: newPath }));
      setAvatarUrl(data.signedUrl);
      setNotice("Your profile photo has been updated.");
    } catch (uploadError) {
      setError(uploadError.message || "Could not upload your profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function exportAccountData() {
    if (!supabase || !userId) return;
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        exported_at: new Date().toISOString(),
        account: {
          id: userId,
          email,
          created_at: session.user.created_at || null,
          last_sign_in_at: session.user.last_sign_in_at || null,
        },
        profile: profile || {},
        preferences: preferences || {},
        records: {},
        file_note: "Notes/PDF metadata and storage paths are included in records.notes. Binary files are not embedded in this JSON export.",
      };

      const results = await Promise.all(EXPORT_TABLES.map(async (table) => {
        const rows = [];
        const pageSize = 1000;
        let offset = 0;
        while (true) {
          const { data, error: queryError } = await supabase
            .from(table)
            .select("*")
            .range(offset, offset + pageSize - 1);
          if (queryError) throw queryError;
          rows.push(...(data || []));
          if (!data || data.length < pageSize) break;
          offset += pageSize;
        }
        return [table, rows];
      }));
      payload.records = Object.fromEntries(results);

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = \`acadly-account-export-\${new Date().toISOString().slice(0, 10)}.json\`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Your account data export has been created.");
    } catch (exportError) {
      setError(exportError.message || "Could not export your account data.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="settings-loading"><LoaderCircle className="auth-spinner" size={19} /> Loading your profile and preferences...</div>;
  }

  return (
    <div className="settings-page">
      <section className="settings-intro">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Settings</h1>
        <p>Manage your profile, personal preferences, and account data.</p>
      </section>

      <form className="settings-panel" onSubmit={saveSettings}>
        <div className="settings-panel-heading">
          <span className="settings-section-icon"><UserRound size={18} /></span>
          <div><h2>Personal profile</h2><p>This information belongs to your private student account.</p></div>
        </div>

        <div className="settings-avatar-row">
          <div className="settings-avatar-preview">
            {avatarUrl
              ? <img src={avatarUrl} alt="Your profile avatar" />
              : <span>{avatarInitial(displayName, email)}</span>}
          </div>
          <div className="settings-avatar-copy">
            <strong>Profile photo</strong>
            <span>PNG, JPEG, or WebP. Maximum file size: 2 MB. Visible only to you.</span>
            <label className="button button-ghost settings-upload-button">
              {avatarBusy ? <LoaderCircle className="auth-spinner" size={14} /> : <Camera size={14} />}
              {avatarBusy ? "Uploading..." : "Change photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={avatarBusy} />
            </label>
          </div>
        </div>

        <div className="settings-fields">
          <label className="field-label">Display name
            <input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" required />
          </label>
          <label className="field-label">Email address
            <input value={email} readOnly disabled />
            <small>Your sign-in email is managed by Supabase Auth.</small>
          </label>
          <label className="field-label settings-field-full">Time zone
            <span className="settings-input-with-icon"><Globe2 size={15} />
              <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                {!timeZones.includes(timezone) && <option value={timezone}>{timezone}</option>}
                {timeZones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}
              </select>
            </span>
          </label>
          <label className="field-label settings-field-full">Start of the week
            <select value={weekStartsOn} onChange={(event) => setWeekStartsOn(Number(event.target.value))}>
              {WEEK_DAYS.map((day) => <option value={day.value} key={day.value}>{day.label}</option>)}
            </select>
          </label>
        </div>

        <SettingsMessage kind="error">{error}</SettingsMessage>
        <SettingsMessage kind="success">{notice}</SettingsMessage>
        <div className="settings-form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="auth-spinner" size={15} /> : <Save size={15} />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      <section className="settings-panel">
        <div className="settings-panel-heading">
          <span className="settings-section-icon"><ShieldCheck size={18} /></span>
          <div><h2>Account and data</h2><p>Review your access and keep a copy of your Acadly data.</p></div>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-icon"><LockKeyhole size={17} /></span>
          <div><strong>Private by default</strong><p>Your profile, preferences, study records, and avatar are protected by account-level database and Storage policies.</p></div>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-icon"><FileJson size={17} /></span>
          <div><strong>Download your data</strong><p>Export your profile, preferences, and study records as JSON. Uploaded PDF/image binaries are not embedded; the export includes their note metadata and private paths.</p></div>
          <button className="button button-ghost settings-row-action" type="button" onClick={exportAccountData} disabled={exporting}>
            {exporting ? <LoaderCircle className="auth-spinner" size={14} /> : <Download size={14} />}
            {exporting ? "Preparing..." : "Export"}
          </button>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-icon"><LogOut size={17} /></span>
          <div><strong>Sign out</strong><p>End this session on the current device.</p></div>
          <button className="button button-ghost settings-row-action" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </section>

      <section className="settings-panel settings-danger-panel">
        <div className="settings-panel-heading">
          <span className="settings-section-icon settings-danger-icon"><AlertTriangle size={18} /></span>
          <div><h2>Account deletion</h2><p>Deletion is permanent and affects your entire student workspace.</p></div>
        </div>
        <p className="settings-policy-copy">An account deletion flow must verify your identity, explain what will be deleted, remove your private avatar and note files, and then delete your Supabase Auth account through a trusted server-side operation. Related database records are configured to cascade from the Auth user. Provider backups and retention windows may continue to apply after application deletion.</p>
        <p className="settings-policy-copy">To avoid leaving private uploaded files behind, self-service deletion is not enabled until the production deletion endpoint and retention policy are configured. Contact the Acadly administrator for a deletion request.</p>
        <button className="button button-danger" type="button" disabled title="Account deletion endpoint is not configured yet">
          <Trash2 size={14} /> Account deletion unavailable
        </button>
      </section>

      <div className="settings-security-footnote"><ShieldCheck size={14} /> Settings are saved to your student account and remain protected by Supabase Row Level Security.</div>
    </div>
  );
}
