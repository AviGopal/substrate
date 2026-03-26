# Dashboard UI Specification

## Overview

This specification defines the React components and pages for organization member management in metabob-cloud-dashboard.

## Page Layout

The Members page follows the existing dashboard patterns (similar to APIKeys.tsx and Projects.tsx):

```
+------------------------------------------------------------------+
| Members                                              [+ Invite]   |
| Manage your team members and invitations                          |
+------------------------------------------------------------------+
| [Search members...]                        [All Roles v] [Refresh]|
+------------------------------------------------------------------+
| PENDING INVITATIONS (2)                                           |
| +--------------------------------------------------------------+ |
| | newuser@example.com    member    Invited 2 days ago  [Revoke]| |
| | another@example.com    admin     Invited 5 days ago  [Revoke]| |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
| ACTIVE MEMBERS (5)                                                |
| +--------------------------------------------------------------+ |
| | [Avatar] Alice Smith    alice@example.com                     | |
| |          Owner          Joined Jan 15, 2026                   | |
| +--------------------------------------------------------------+ |
| | [Avatar] Bob Jones      bob@example.com      [Role: Admin v]  | |
| |          Admin          Joined Feb 1, 2026       [Remove]     | |
| +--------------------------------------------------------------+ |
| | [Avatar] Carol White    carol@example.com    [Role: Member v] | |
| |          Member         Joined Mar 10, 2026      [Remove]     | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

## File Structure

```
repos/metabob-cloud-dashboard/src/
  pages/
    Members.tsx                    # Main members page
  components/
    members/
      MemberRow.tsx                # Single member display
      InvitationRow.tsx            # Pending invitation display
      InviteModal.tsx              # Invite member modal
      RoleDropdown.tsx             # Role selection dropdown
      RemoveMemberDialog.tsx       # Confirmation for removal
      TransferOwnershipDialog.tsx  # Ownership transfer modal
      LeaveOrgDialog.tsx           # Leave organization confirmation
  hooks/
    useMembers.tsx                 # Members state management
  lib/api/
    members.ts                     # API client functions
```

## Component Specifications

### Members.tsx (Main Page)

```tsx
/**
 * Organization members management page
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import { MemberRow } from "@/components/members/MemberRow";
import { InvitationRow } from "@/components/members/InvitationRow";
import { InviteModal } from "@/components/members/InviteModal";
import { TransferOwnershipDialog } from "@/components/members/TransferOwnershipDialog";
import { LeaveOrgDialog } from "@/components/members/LeaveOrgDialog";
import type { OrganizationMember, OrganizationInvitation, MemberRole } from "@/types/api";

export function Members() {
  const { user } = useAuth();
  const {
    members,
    invitations,
    isLoading,
    error,
    refresh,
    inviteMember,
    updateRole,
    removeMember,
    revokeInvitation,
    leaveOrganization,
    transferOwnership,
  } = useMembers();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRole | "all">("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Current user's role in the org
  const currentMember = members.find(m => m.user_id === user?.id);
  const isOwner = currentMember?.role === "owner";
  const isAdmin = currentMember?.role === "admin" || isOwner;

  // Filter members by search and role
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Separate pending invitations
  const pendingInvitations = invitations.filter(i => i.status === "pending");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground">
            Manage your team members and invitations
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button
              variant="outline"
              onClick={() => setShowTransferDialog(true)}
              data-testid="transfer-ownership-btn"
            >
              Transfer Ownership
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowInviteModal(true)} data-testid="invite-member-btn">
              + Invite
            </Button>
          )}
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="member-search"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as MemberRole | "all")}
          className="px-3 py-2 border rounded-md bg-background"
          data-testid="role-filter"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <Button variant="outline" onClick={refresh} data-testid="refresh-btn">
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      {/* Pending Invitations */}
      {isAdmin && pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  onRevoke={() => revokeInvitation(invitation.id)}
                  data-testid={`invitation-${invitation.id}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle>
            Active Members ({filteredMembers.length})
          </CardTitle>
          <CardDescription>
            Team members with access to this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-3">
                  <div className="h-5 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2 mt-2" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No members found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUserRole={currentMember?.role || "member"}
                  isCurrentUser={member.user_id === user?.id}
                  onRoleChange={(role) => updateRole(member.id, role)}
                  onRemove={() => removeMember(member.id)}
                  data-testid={`member-${member.id}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave organization option (for non-owners) */}
      {!isOwner && currentMember && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground">Leave Organization</h4>
                <p className="text-sm text-muted-foreground">
                  Remove yourself from this organization
                </p>
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowLeaveDialog(true)}
                data-testid="leave-org-btn"
              >
                Leave
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvite={inviteMember}
        />
      )}

      {showTransferDialog && (
        <TransferOwnershipDialog
          members={members.filter(m => m.role === "admin")}
          onClose={() => setShowTransferDialog(false)}
          onTransfer={transferOwnership}
        />
      )}

      {showLeaveDialog && (
        <LeaveOrgDialog
          onClose={() => setShowLeaveDialog(false)}
          onLeave={leaveOrganization}
        />
      )}
    </div>
  );
}

export default Members;
```

### MemberRow.tsx

```tsx
/**
 * Single member row with role management
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleDropdown } from "./RoleDropdown";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import type { OrganizationMember, MemberRole } from "@/types/api";

interface MemberRowProps {
  member: OrganizationMember;
  currentUserRole: MemberRole;
  isCurrentUser: boolean;
  onRoleChange: (role: MemberRole) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function MemberRow({
  member,
  currentUserRole,
  isCurrentUser,
  onRoleChange,
  onRemove,
}: MemberRowProps) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const canChangeRole =
    !isCurrentUser &&
    member.role !== "owner" &&
    (currentUserRole === "owner" ||
      (currentUserRole === "admin" && member.role !== "admin"));

  const canRemove =
    !isCurrentUser &&
    member.role !== "owner" &&
    (currentUserRole === "owner" ||
      (currentUserRole === "admin" && member.role !== "admin"));

  // Format join date
  const joinedDate = member.joined_at
    ? new Date(member.joined_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown";

  return (
    <div
      className="flex items-center justify-between py-3 border-b border-border last:border-0"
      data-testid={`member-row-${member.id}`}
    >
      <div className="flex items-center gap-4">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
          {member.user_name.charAt(0).toUpperCase()}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{member.user_name}</span>
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">{member.user_email}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="capitalize">{member.role}</span>
            <span className="mx-1">-</span>
            <span>Joined {joinedDate}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canChangeRole ? (
          <RoleDropdown
            currentRole={member.role}
            canPromoteToAdmin={currentUserRole === "owner"}
            onChange={onRoleChange}
            data-testid={`role-dropdown-${member.id}`}
          />
        ) : (
          <span className="px-3 py-1.5 text-sm text-muted-foreground capitalize">
            {member.role}
          </span>
        )}

        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRemoveDialog(true)}
            className="text-destructive hover:text-destructive"
            data-testid={`remove-btn-${member.id}`}
          >
            Remove
          </Button>
        )}
      </div>

      {showRemoveDialog && (
        <RemoveMemberDialog
          memberName={member.user_name}
          onClose={() => setShowRemoveDialog(false)}
          onConfirm={onRemove}
        />
      )}
    </div>
  );
}
```

### InviteModal.tsx

```tsx
/**
 * Modal for inviting new members
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberRole } from "@/types/api";

interface InviteModalProps {
  onClose: () => void;
  onInvite: (email: string, role: MemberRole) => Promise<{ invitation_url?: string }>;
}

export function InviteModal({ onClose, onInvite }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onInvite(email.trim(), role);
      if (result.invitation_url) {
        setInvitationUrl(result.invitation_url);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (invitationUrl) {
      await navigator.clipboard.writeText(invitationUrl);
    }
  };

  // Show success state with invitation URL
  if (invitationUrl) {
    return (
      <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
        <Card className="w-full max-w-md" data-testid="invite-success">
          <CardHeader>
            <CardTitle>Invitation Sent</CardTitle>
            <CardDescription>
              Share this link with {email} to invite them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <code className="text-sm break-all">{invitationUrl}</code>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={copyToClipboard}>
                Copy Link
              </Button>
              <Button onClick={onClose} data-testid="close-invite-modal">
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
      <Card className="w-full max-w-md" data-testid="invite-modal">
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>
            Send an invitation to join your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="invite-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              data-testid="invite-role"
            >
              <option value="admin">Admin - Can manage members and resources</option>
              <option value="member">Member - Can create and edit resources</option>
              <option value="viewer">Viewer - Read-only access</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !email.trim()}
              data-testid="send-invite"
            >
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### useMembers.tsx (Hook)

```tsx
/**
 * Members state management hook
 */

import { useState, useEffect, useCallback } from "react";
import {
  getMembers,
  getInvitations,
  inviteMember as apiInviteMember,
  updateMemberRole,
  removeMember as apiRemoveMember,
  revokeInvitation as apiRevokeInvitation,
  leaveOrganization as apiLeaveOrganization,
  transferOwnership as apiTransferOwnership,
} from "@/lib/api/members";
import type { OrganizationMember, OrganizationInvitation, MemberRole } from "@/types/api";

export function useMembers() {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [membersResponse, invitationsResponse] = await Promise.all([
        getMembers(),
        getInvitations(),
      ]);

      if (membersResponse.error) {
        setError(membersResponse.error.message);
        return;
      }
      if (invitationsResponse.error) {
        setError(invitationsResponse.error.message);
        return;
      }

      setMembers(membersResponse.data?.members || []);
      setInvitations(invitationsResponse.data?.invitations || []);
    } catch (err) {
      setError("Failed to load members");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const inviteMember = async (email: string, role: MemberRole) => {
    const response = await apiInviteMember(email, role);
    if (response.error) {
      throw new Error(response.error.message);
    }
    // Refresh invitations list
    loadData();
    return response.data || {};
  };

  const updateRole = async (memberId: string, role: MemberRole) => {
    const response = await updateMemberRole(memberId, role);
    if (response.error) {
      throw new Error(response.error.message);
    }
    // Update local state
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
  };

  const removeMember = async (memberId: string) => {
    const response = await apiRemoveMember(memberId);
    if (response.error) {
      throw new Error(response.error.message);
    }
    // Remove from local state
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const revokeInvitation = async (invitationId: string) => {
    const response = await apiRevokeInvitation(invitationId);
    if (response.error) {
      throw new Error(response.error.message);
    }
    // Remove from local state
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  };

  const leaveOrganization = async () => {
    const response = await apiLeaveOrganization();
    if (response.error) {
      throw new Error(response.error.message);
    }
    // Redirect to home or login will happen automatically
  };

  const transferOwnership = async (newOwnerId: string) => {
    const response = await apiTransferOwnership(newOwnerId, "TRANSFER");
    if (response.error) {
      throw new Error(response.error.message);
    }
    // Refresh to update roles
    loadData();
  };

  return {
    members,
    invitations,
    isLoading,
    error,
    refresh: loadData,
    inviteMember,
    updateRole,
    removeMember,
    revokeInvitation,
    leaveOrganization,
    transferOwnership,
  };
}
```

### lib/api/members.ts

```typescript
/**
 * API client for member management
 */

import { get, post, put, del } from "./client";
import type {
  OrganizationMember,
  OrganizationInvitation,
  MemberRole,
} from "@/types/api";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Members
export function getMembers(params?: { status?: string; role?: string }) {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return get<{ members: OrganizationMember[]; total: number }>(
    `${API_BASE}/v2/organizations/current/members${query ? `?${query}` : ""}`
  );
}

export function getMember(memberId: string) {
  return get<{ member: OrganizationMember }>(
    `${API_BASE}/v2/organizations/current/members/${memberId}`
  );
}

export function inviteMember(email: string, role: MemberRole) {
  return post<{ invitation: OrganizationInvitation; invitation_url: string }>(
    `${API_BASE}/v2/organizations/current/members/invite`,
    { email, role }
  );
}

export function updateMemberRole(memberId: string, role: MemberRole) {
  return put<{ member: OrganizationMember }>(
    `${API_BASE}/v2/organizations/current/members/${memberId}/role`,
    { role }
  );
}

export function removeMember(memberId: string) {
  return del<{ message: string }>(
    `${API_BASE}/v2/organizations/current/members/${memberId}`
  );
}

export function leaveOrganization() {
  return post<{ message: string }>(
    `${API_BASE}/v2/organizations/current/members/leave`
  );
}

export function transferOwnership(newOwnerId: string, confirmation: string) {
  return post<{ message: string; new_owner: { id: string; name: string } }>(
    `${API_BASE}/v2/organizations/current/transfer-ownership`,
    { new_owner_id: newOwnerId, confirmation }
  );
}

// Invitations
export function getInvitations(params?: { status?: string }) {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return get<{ invitations: OrganizationInvitation[]; total: number }>(
    `${API_BASE}/v2/organizations/current/invitations${query ? `?${query}` : ""}`
  );
}

export function revokeInvitation(invitationId: string) {
  return del<{ message: string }>(
    `${API_BASE}/v2/organizations/current/invitations/${invitationId}`
  );
}

// Public invitation endpoints (no auth)
export function getInvitationDetails(token: string) {
  return get<{
    invitation: {
      org_name: string;
      role: MemberRole;
      invited_by_name: string;
      expires_at: string;
      is_expired: boolean;
    };
  }>(`${API_BASE}/v2/invitations/${token}`);
}

export function acceptInvitation(token: string) {
  return post<{ member: OrganizationMember; message: string }>(
    `${API_BASE}/v2/invitations/${token}/accept`
  );
}

export function declineInvitation(token: string) {
  return post<{ message: string }>(
    `${API_BASE}/v2/invitations/${token}/decline`
  );
}
```

## Navigation Integration

Add to the sidebar navigation in the dashboard layout:

```tsx
// In sidebar/nav component
<NavItem
  href="/members"
  icon={UsersIcon}
  label="Members"
  data-testid="nav-members"
/>
```

## Route Registration

Add to the router configuration:

```tsx
// In App.tsx or routes config
{
  path: "/members",
  element: <Members />,
}
```

## Accessibility Requirements

- All interactive elements must be keyboard accessible
- Role dropdowns use native `<select>` for best accessibility
- Modals trap focus and can be dismissed with Escape key
- Loading states announced to screen readers
- Error messages linked to form fields with aria-describedby
- Confirmation dialogs have clear focus on confirm/cancel buttons
