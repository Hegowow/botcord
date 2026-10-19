import "./styles.css";

import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { Alerts, Select, showToast, TextInput, Toasts, useRef, useState } from "@webpack/common";

import { prepareBadgeImage } from "./image";
import { countBadgeUsers, createBadge, deleteBadge, KahoBadge, updateBadge, useBadgeStore } from "./store";

const cl = classNameFactory("kc-badges-");

type ClickAction = "none" | "link";

interface Draft {
    editingId: string | null;
    description: string;
    action: ClickAction;
    link: string;
    image: string | null;
    imageInfo: string | null;
}

const emptyDraft: Draft = { editingId: null, description: "", action: "none", link: "", image: null, imageInfo: null };

const actionOptions = [
    { label: "Rien", value: "none" },
    { label: "Ouvrir un lien", value: "link" },
];

function BadgeRow({ badge, onEdit, busy }: { badge: KahoBadge; onEdit?(): void; busy: boolean; }) {
    const users = countBadgeUsers(badge.id);
    return (
        <div className={cl("row")}>
            <img className={cl("row-icon")} src={badge.icon} alt="" width={36} height={36} />
            <div className={cl("row-text")}>
                <span className={cl("row-title")}>{badge.description}</span>
                <span className={cl("row-meta")}>
                    {badge.link ? `Clic : ouvre ${badge.link}` : "Clic : rien"} · {users} utilisateur{users > 1 ? "s" : ""}
                </span>
            </div>
            {onEdit && (
                <div className={cl("row-actions")}>
                    <Button size="small" variant="secondary" disabled={busy} onClick={onEdit}>Modifier</Button>
                    <Button
                        size="small"
                        variant="dangerSecondary"
                        disabled={busy}
                        onClick={() => Alerts.show({
                            title: "Supprimer le badge ?",
                            body: `« ${badge.description} » sera retiré de tous les utilisateurs. Cette action est définitive.`,
                            confirmText: "Supprimer",
                            cancelText: "Annuler",
                            onConfirm: async () => {
                                try {
                                    await deleteBadge(badge.id);
                                    showToast("Badge supprimé", Toasts.Type.SUCCESS);
                                } catch (error) {
                                    showToast((error as Error).message, Toasts.Type.FAILURE);
                                }
                            },
                        })}
                    >
                        Supprimer
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function AdminPanel() {
    const { state, admin } = useBadgeStore();
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const badgeSize = state?.badgeSize ?? 72;

    if (admin.status !== "valid") {
        return <Paragraph>Cette page est réservée aux administrateurs KahoCord.</Paragraph>;
    }

    const customBadges = state?.badges.filter(badge => badge.kind === "custom") ?? [];
    const systemBadge = state?.badges.find(badge => badge.kind === "system");
    const update = (changes: Partial<Draft>) => setDraft(current => ({ ...current, ...changes }));

    const pickImage = async (file: File | undefined) => {
        if (!file) return;
        try {
            const prepared = await prepareBadgeImage(file, badgeSize);
            const square = prepared.sourceWidth === prepared.sourceHeight;
            const small = Math.min(prepared.sourceWidth, prepared.sourceHeight) < badgeSize;
            const notes = [`Image d'origine : ${prepared.sourceWidth}×${prepared.sourceHeight}`];
            if (!square) notes.push("recadrée au centre en carré");
            if (small) notes.push("agrandie, elle risque d'être floue");
            update({ image: prepared.dataUrl, imageInfo: notes.join(", ") });
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const submit = async () => {
        setError(null);
        if (!draft.description.trim()) return setError("Le titre du badge est obligatoire");
        if (!draft.editingId && !draft.image) return setError("Choisis une image pour le badge");
        if (draft.action === "link" && !draft.link.trim()) return setError("Indique le lien à ouvrir");
        const link = draft.action === "link" ? draft.link.trim() : null;
        setBusy(true);
        try {
            if (draft.editingId) {
                await updateBadge(draft.editingId, { description: draft.description, link, ...(draft.image ? { image: draft.image } : {}) });
                showToast("Badge modifié", Toasts.Type.SUCCESS);
            } else {
                await createBadge({ description: draft.description, link, image: draft.image! });
                showToast("Badge créé", Toasts.Type.SUCCESS);
            }
            setDraft(emptyDraft);
            if (fileInput.current) fileInput.current.value = "";
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const editingBadge = draft.editingId ? customBadges.find(badge => badge.id === draft.editingId) : undefined;
    const preview = draft.image ?? editingBadge?.icon ?? null;

    return (
        <div className={cl("panel")}>
            <Paragraph className={cl("intro")}>
                Connecté en tant qu'admin « {admin.label} ». Les badges créés ici sont visibles par tous les utilisateurs de KahoCord.
                Pour attribuer ou retirer un badge, fais un clic droit sur un utilisateur.
            </Paragraph>

            <Heading tag="h3" className={cl("section-title")}>
                {draft.editingId ? "Modifier le badge" : "Nouveau badge"}
            </Heading>

            <div className={cl("form")}>
                <div className={cl("image-picker")}>
                    <div className={cl("preview")}>
                        {preview ? <img src={preview} alt="" width={badgeSize} height={badgeSize} /> : <span>{badgeSize}×{badgeSize}</span>}
                    </div>
                    <div className={cl("image-text")}>
                        <Button size="small" variant="secondary" onClick={() => fileInput.current?.click()}>
                            {preview ? "Changer l'image" : "Choisir une image"}
                        </Button>
                        <span className={cl("hint")}>
                            Format Discord : PNG {badgeSize}×{badgeSize} px. Toute image est automatiquement recadrée et redimensionnée.
                        </span>
                        {draft.imageInfo && <span className={cl("hint")}>{draft.imageInfo}</span>}
                    </div>
                    <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        hidden
                        onChange={event => pickImage(event.currentTarget.files?.[0])}
                    />
                </div>

                <Heading tag="h5" className={cl("label")}>Titre au survol</Heading>
                <TextInput
                    value={draft.description}
                    placeholder="Ex. : Membre fondateur"
                    maxLength={100}
                    onChange={(value: string) => update({ description: value })}
                />

                <Heading tag="h5" className={cl("label")}>Au clic</Heading>
                <Select
                    options={actionOptions}
                    isSelected={(value: ClickAction) => value === draft.action}
                    select={(value: ClickAction) => update({ action: value })}
                    serialize={(value: string) => value}
                    closeOnSelect
                />

                {draft.action === "link" && (
                    <>
                        <Heading tag="h5" className={cl("label")}>Lien à ouvrir</Heading>
                        <TextInput
                            value={draft.link}
                            placeholder="https://"
                            onChange={(value: string) => update({ link: value })}
                        />
                    </>
                )}

                {error && <Paragraph className={cl("error")}>{error}</Paragraph>}

                <div className={cl("form-actions")}>
                    <Button disabled={busy} onClick={submit}>
                        {draft.editingId ? "Enregistrer" : "Créer le badge"}
                    </Button>
                    {draft.editingId && (
                        <Button variant="secondary" disabled={busy} onClick={() => setDraft(emptyDraft)}>Annuler</Button>
                    )}
                </div>
            </div>

            <Divider className={cl("divider")} />

            <Heading tag="h3" className={cl("section-title")}>Badges personnalisés ({customBadges.length})</Heading>
            {customBadges.length === 0 && <Paragraph className={cl("hint")}>Aucun badge personnalisé pour l'instant.</Paragraph>}
            {customBadges.map(badge => (
                <BadgeRow
                    key={badge.id}
                    badge={badge}
                    busy={busy}
                    onEdit={() => setDraft({
                        editingId: badge.id,
                        description: badge.description,
                        action: badge.link ? "link" : "none",
                        link: badge.link ?? "",
                        image: null,
                        imageInfo: null,
                    })}
                />
            ))}

            {systemBadge && (
                <>
                    <Divider className={cl("divider")} />
                    <Heading tag="h3" className={cl("section-title")}>Badge automatique</Heading>
                    <Paragraph className={cl("hint")}>Attribué automatiquement à chaque compte connecté via KahoCord.</Paragraph>
                    <BadgeRow badge={systemBadge} busy={busy} />
                </>
            )}
        </div>
    );
}
