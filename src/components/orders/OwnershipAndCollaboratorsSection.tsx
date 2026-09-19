import { useEffect, useState } from "react";
import { ChevronDown, UserRoundCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OrderForOthersInfo } from "@/components/orders/OrderForOthersInfo";
import { OrderCollaborationInfo } from "@/components/orders/OrderCollaborationInfo";
import { OrderOwnershipChain } from "@/components/orders/OrderOwnershipChain";
import { OrderCollaboratorsList } from "@/components/orders/OrderCollaboratorsList";

interface CollaboratorSummary {
  id: string;
  name: string;
  role: string | null;
}

interface OwnershipAndCollaboratorsSectionProps {
  orderId: string;
  currentOwnerId: string;
  ownerName?: string;
  ownerPhone?: string;
  transferredFromUserId?: string;
  transferredFromPhone?: string;
  executedBy?: string;
  approvedBy?: string;
  onStatusChange?: () => void;
}

export function OwnershipAndCollaboratorsSection({
  orderId,
  currentOwnerId,
  ownerName,
  ownerPhone,
  transferredFromUserId,
  transferredFromPhone,
  executedBy,
  approvedBy,
  onStatusChange,
}: OwnershipAndCollaboratorsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaboratorSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchCollaboratorSummary = async () => {
      const { data, error } = await supabase
        .from("order_collaborators")
        .select("id, invitee_user_id, collaborator_name, collaborator_role")
        .eq("order_id", orderId)
        .in("status", ["accepted", "approved"])
        .order("invited_at", { ascending: false });

      if (error || !data?.length) {
        if (!cancelled) setCollaborators([]);
        return;
      }

      const userIds = data
        .map((row) => row.invitee_user_id)
        .filter((userId): userId is string => Boolean(userId));
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const profileNames = new Map((profiles || []).map((profile) => [profile.user_id, profile.full_name]));

      if (!cancelled) {
        setCollaborators(
          data.map((row) => ({
            id: row.id,
            name:
              row.collaborator_name ||
              (row.invitee_user_id ? profileNames.get(row.invitee_user_id) : null) ||
              "همکار سفارش",
            role: row.collaborator_role,
          }))
        );
      }
    };

    fetchCollaboratorSummary();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer gap-2 py-3 transition-colors hover:bg-muted/40 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex min-w-0 items-center gap-2 text-sm sm:text-base">
                <Users className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate">زنجیره مالکیت و همکاران سفارش</span>
              </CardTitle>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>

            <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
              {collaborators.length > 0 ? (
                <>
                  <UserRoundCheck className="h-4 w-4 shrink-0 text-primary" />
                  <span className="shrink-0 text-xs text-muted-foreground">همکاران:</span>
                  <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                    {collaborators.slice(0, 3).map((collaborator) => (
                      <Badge key={collaborator.id} variant="secondary" className="max-w-40 shrink-0 gap-1 text-xs font-normal">
                        <span className="truncate">{collaborator.name}</span>
                        {collaborator.role && <span className="text-muted-foreground">· {collaborator.role}</span>}
                      </Badge>
                    ))}
                    {collaborators.length > 3 && (
                      <Badge variant="outline" className="shrink-0 text-xs">+{collaborators.length - 3}</Badge>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">مالک فعلی و سابقه سفارش</span>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 border-t bg-muted/10 p-3 sm:p-5">
            <OrderForOthersInfo orderId={orderId} onStatusChange={onStatusChange} />
            <OrderCollaborationInfo orderId={orderId} />
            <OrderOwnershipChain
              orderId={orderId}
              currentOwnerId={currentOwnerId}
              ownerName={ownerName}
              ownerPhone={ownerPhone}
              transferredFromUserId={transferredFromUserId}
              transferredFromPhone={transferredFromPhone}
              executedBy={executedBy}
              approvedBy={approvedBy}
            />
            <OrderCollaboratorsList
              orderId={orderId}
              isOwner
              ownerName={ownerName}
              ownerPhone={ownerPhone}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}