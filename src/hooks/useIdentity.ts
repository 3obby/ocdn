"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type Identity,
  type IdentityMode,
  type UnsignedEvent,
  type SignedEvent,
  getIdentity,
  signEvent,
  hasNip07,
  getNip07Pubkey,
  generateEphemeralKeypair,
  getEphemeralKeypair,
  shouldPromptClaim,
  buildClaimEvent,
} from "@/lib/nostr/identity";

interface UseIdentityReturn {
  identity: Identity;
  /** Try to connect via NIP-07. Falls back to ephemeral. */
  login: () => Promise<void>;
  /** Sign an event with current identity */
  sign: (event: UnsignedEvent) => Promise<{ event: SignedEvent; mode: IdentityMode } | null>;
  /** Whether the user should be prompted to claim ephemeral key */
  showClaim: boolean;
  /** Execute the claim flow (link ephemeral to NIP-07) */
  claim: () => Promise<boolean>;
  /** Loading state */
  loading: boolean;
}

export function useIdentity(): UseIdentityReturn {
  const [identity, setIdentity] = useState<Identity>({ mode: "none", pubkey: null });
  const [showClaim, setShowClaim] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check identity on mount
  useEffect(() => {
    getIdentity().then((id) => {
      setIdentity(id);
      setShowClaim(shouldPromptClaim());
      setLoading(false);
    });
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    try {
      if (hasNip07()) {
        const pubkey = await getNip07Pubkey();
        if (pubkey) {
          setIdentity({ mode: "nip07", pubkey });
          setShowClaim(shouldPromptClaim());
          setLoading(false);
          return;
        }
      }
      // No NIP-07 — generate ephemeral
      let kp = getEphemeralKeypair();
      if (!kp) kp = generateEphemeralKeypair();
      setIdentity({ mode: "ephemeral", pubkey: kp.pk });
    } finally {
      setLoading(false);
    }
  }, []);

  const sign = useCallback(async (event: UnsignedEvent) => {
    return signEvent(event);
  }, []);

  const claim = useCallback(async (): Promise<boolean> => {
    const ephemeral = getEphemeralKeypair();
    if (!ephemeral) return false;

    const claimEvent = await buildClaimEvent(ephemeral.pk);
    if (!claimEvent) return false;

    // Submit claim to server
    try {
      const res = await fetch("/api/fortify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentHash: "claim",
          sats: "0",
          proof: "claim",
          eventId: claimEvent.id,
          funderPubkey: claimEvent.pubkey,
          claimFrom: ephemeral.pk,
        }),
      });

      if (res.ok) {
        const newId = await getIdentity();
        setIdentity(newId);
        setShowClaim(false);
        return true;
      }
    } catch {
      // Claim failed
    }
    return false;
  }, []);

  return { identity, login, sign, showClaim, claim, loading };
}
