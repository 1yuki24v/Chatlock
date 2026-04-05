"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Shield,
  Key,
  Lock,
  Bell,
  Eye,
  Trash2,
  LogOut,
  ChevronRight,
  Fingerprint,
  Moon,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useEncryption } from "@/hooks/useEncryption";

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

const SettingItem = ({ icon, title, description, action, onClick, danger }: SettingItemProps) => {
  const isClickable = Boolean(onClick);
  const Wrapper: "button" | "div" = isClickable ? "button" : "div";

  return (
    <Wrapper
      // Only attach click handler when actually clickable
      {...(isClickable ? { onClick } : {})}
      className={`w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors rounded-xl ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl ${
          danger ? "bg-destructive/20" : "bg-secondary"
        } flex items-center justify-center`}
      >
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action || <ChevronRight className="w-5 h-5 text-muted-foreground" />}
    </Wrapper>
  );
};

type ThemeMode = "system" | "light" | "dark";
type AppLanguage = "English" | "Spanish";

interface UserSettings {
  biometric: boolean;
  notifications: boolean;
  readReceipts: boolean;
  appLockSeconds: number;
  theme: ThemeMode;
  language: AppLanguage;
}

const DEFAULT_SETTINGS: UserSettings = {
  biometric: true,
  notifications: true,
  readReceipts: false,
  appLockSeconds: 60,
  theme: "system",
  language: "English",
};

const SettingsScreen = () => {
  const router = useRouter();
  const { address, disconnect } = useWallet();
  const { encryptionKeys, initializeEncryption } = useEncryption();
  const [biometric, setBiometric] = useState(DEFAULT_SETTINGS.biometric);
  const [notifications, setNotifications] = useState(DEFAULT_SETTINGS.notifications);
  const [readReceipts, setReadReceipts] = useState(DEFAULT_SETTINGS.readReceipts);
  const [appLockSeconds, setAppLockSeconds] = useState(DEFAULT_SETTINGS.appLockSeconds);
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_SETTINGS.theme);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_SETTINGS.language);

  const initials = useMemo(() => {
    if (!address) return "NA";
    return `${address.slice(2, 3)}${address.slice(-1)}`.toUpperCase();
  }, [address]);

  const shortAddress = useMemo(() => {
    if (!address) return "Wallet not connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const settingsStorageKey = useMemo(
    () => `chatlock_settings_${(address || "guest").toLowerCase()}`,
    [address]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(settingsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      setBiometric(parsed.biometric ?? DEFAULT_SETTINGS.biometric);
      setNotifications(parsed.notifications ?? DEFAULT_SETTINGS.notifications);
      setReadReceipts(parsed.readReceipts ?? DEFAULT_SETTINGS.readReceipts);
      setAppLockSeconds(parsed.appLockSeconds ?? DEFAULT_SETTINGS.appLockSeconds);
      setTheme(parsed.theme ?? DEFAULT_SETTINGS.theme);
      setLanguage(parsed.language ?? DEFAULT_SETTINGS.language);
    } catch {
      // ignore malformed settings and keep defaults
    }
  }, [settingsStorageKey]);

  useEffect(() => {
    const next: UserSettings = {
      biometric,
      notifications,
      readReceipts,
      appLockSeconds,
      theme,
      language,
    };
    localStorage.setItem(settingsStorageKey, JSON.stringify(next));
  }, [biometric, notifications, readReceipts, appLockSeconds, theme, language, settingsStorageKey]);

  useEffect(() => {
    // Keep styling approach lightweight for current CSS setup.
    if (theme === "system") {
      document.documentElement.style.colorScheme = "light dark";
      return;
    }
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const handleManageKeys = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Connect your wallet to manage encryption keys.",
        variant: "destructive",
      });
      return;
    }
    if (encryptionKeys?.publicKey) {
      await navigator.clipboard.writeText(encryptionKeys.publicKey);
      toast({
        title: "Public key copied",
        description: "Your encryption public key is copied to clipboard.",
      });
      return;
    }
    await initializeEncryption();
    toast({
      title: "Keys initialized",
      description: "Encryption keys are ready for this wallet.",
    });
  };

  const handleToggleAppLock = () => {
    const next = appLockSeconds === 60 ? 300 : 60;
    setAppLockSeconds(next);
    toast({
      title: "App lock updated",
      description: `Auto-lock set to ${next === 60 ? "1 minute" : "5 minutes"}.`,
    });
  };

  const handleAppearance = () => {
    const next: ThemeMode =
      theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
    toast({
      title: "Appearance updated",
      description: `Theme set to ${next}.`,
    });
  };

  const handleLanguage = () => {
    const next: AppLanguage = language === "English" ? "Spanish" : "English";
    setLanguage(next);
    toast({
      title: "Language updated",
      description: `Language set to ${next}.`,
    });
  };

  const handleDeleteAllMessages = () => {
    const allKeys = Object.keys(localStorage);
    const messageKeys = allKeys.filter(
      (k) =>
        k.startsWith("chatlock_contacts_") ||
        k.startsWith("chatlock_settings_")
    );
    messageKeys.forEach((k) => localStorage.removeItem(k));
    toast({
      title: "Local data cleared",
      description: "Local contacts and settings were removed on this device.",
    });
  };

  const handleLogout = () => {
    disconnect();
    toast({
      title: "Wallet disconnected",
      description: "Your wallet session has been disconnected.",
    });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border-b border-border p-4 sticky top-0 z-20"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/chats")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Security & Privacy</p>
          </div>
        </div>
      </motion.header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-success flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">{initials}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                {address ? "Connected wallet" : "Guest"}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">{shortAddress}</p>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-success/20 rounded-full">
              <Shield className="w-3 h-3 text-success" />
              <span className="text-xs text-success font-medium">
                {address ? "Verified" : "Offline"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Security Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-medium text-muted-foreground px-4">Security</h3>
          <div className="glass-card divide-y divide-border overflow-hidden">
            <SettingItem
              icon={<Key className="w-5 h-5 text-primary" />}
              title="Encryption Keys"
              description="Copy or initialize your encryption key"
              onClick={handleManageKeys}
            />
            <SettingItem
              icon={<Fingerprint className="w-5 h-5 text-primary" />}
              title="Biometric Lock"
              description="Require fingerprint to open"
              action={
                <Switch
                  checked={biometric}
                  onCheckedChange={setBiometric}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            />
            <SettingItem
              icon={<Lock className="w-5 h-5 text-primary" />}
              title="App Lock"
              description={`Auto-lock after ${appLockSeconds === 60 ? "1 minute" : "5 minutes"}`}
              onClick={handleToggleAppLock}
            />
          </div>
        </motion.div>

        {/* Privacy Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-medium text-muted-foreground px-4">Privacy</h3>
          <div className="glass-card divide-y divide-border overflow-hidden">
            <SettingItem
              icon={<Eye className="w-5 h-5 text-primary" />}
              title="Read Receipts"
              description="Show when you've read messages"
              action={
                <Switch
                  checked={readReceipts}
                  onCheckedChange={setReadReceipts}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            />
            <SettingItem
              icon={<Bell className="w-5 h-5 text-primary" />}
              title="Notifications"
              description="Message alerts"
              action={
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            />
          </div>
        </motion.div>

        {/* Preferences Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-medium text-muted-foreground px-4">Preferences</h3>
          <div className="glass-card divide-y divide-border overflow-hidden">
            <SettingItem
              icon={<Moon className="w-5 h-5 text-primary" />}
              title="Appearance"
              description={theme}
              onClick={handleAppearance}
            />
            <SettingItem
              icon={<Globe className="w-5 h-5 text-primary" />}
              title="Language"
              description={language}
              onClick={handleLanguage}
            />
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-medium text-muted-foreground px-4">Account</h3>
          <div className="glass-card divide-y divide-border overflow-hidden">
            <SettingItem
              icon={<Trash2 className="w-5 h-5 text-destructive" />}
              title="Delete All Messages"
              danger
              onClick={handleDeleteAllMessages}
            />
            <SettingItem
              icon={<LogOut className="w-5 h-5 text-destructive" />}
              title="Disconnect Wallet"
              danger
              onClick={handleLogout}
            />
          </div>
        </motion.div>

        {/* Version */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground py-4"
        >
          ChatLock v1.0.0 • Built with 🔐
        </motion.p>
      </div>
    </div>
  );
};

export default SettingsScreen;
