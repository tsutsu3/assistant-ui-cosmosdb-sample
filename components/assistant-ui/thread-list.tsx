import { type FC, useState } from "react";
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAssistantState,
} from "@assistant-ui/react";
import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const ThreadList: FC = () => {
  return (
    <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex flex-col items-stretch gap-1.5">
      <ThreadListNew />
      <ThreadListItems />
    </ThreadListPrimitive.Root>
  );
};

const ThreadListNew: FC = () => {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        className="aui-thread-list-new flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start hover:bg-muted data-active:bg-muted"
        variant="ghost"
      >
        <PlusIcon />
        New Thread
      </Button>
    </ThreadListPrimitive.New>
  );
};

const ThreadListItems: FC = () => {
  const isLoading = useAssistantState(({ threads }) => threads.isLoading);

  if (isLoading) {
    return <ThreadListSkeleton />;
  }

  return <ThreadListPrimitive.Items components={{ ThreadListItem }} />;
};

const ThreadListSkeleton: FC = () => {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading threads"
          aria-live="polite"
          className="aui-thread-list-skeleton-wrapper flex items-center gap-2 rounded-md px-3 py-2"
        >
          <Skeleton className="aui-thread-list-skeleton h-[22px] flex-grow" />
        </div>
      ))}
    </>
  );
};

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="aui-thread-list-item flex items-center gap-2 rounded-lg transition-all hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-active:bg-muted">
      <ThreadListItemPrimitive.Trigger className="aui-thread-list-item-trigger flex-grow px-3 py-2 text-start">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemMenu />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemTitle: FC = () => {
  return (
    <span className="aui-thread-list-item-title text-sm">
      <ThreadListItemPrimitive.Title fallback="New Chat" />
    </span>
  );
};

const ThreadListItemMenu: FC = () => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    setMenuOpen(false);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <Popover open={isMenuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label="Open thread actions"
            type="button"
            size="icon"
            variant="ghost"
            className="aui-thread-list-item-menu-trigger mr-2 ml-auto size-8 p-2 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="aui-thread-list-item-menu w-44 p-1"
        >
          <ThreadListItemPrimitive.Archive
            className="aui-thread-list-item-menu-archive flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => setMenuOpen(false)}
          >
            <ArchiveIcon className="size-4" />
            Archive thread
          </ThreadListItemPrimitive.Archive>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="aui-thread-list-item-menu-delete flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <TrashIcon className="size-4" />
            Delete thread
          </button>
        </PopoverContent>
      </Popover>
      <ThreadListItemDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
};

type ThreadListItemDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ThreadListItemDeleteDialog: FC<ThreadListItemDeleteDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this thread?</DialogTitle>
          <DialogDescription>
            This action permanently removes the conversation and cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="aui-thread-list-item-delete-dialog-footer">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <ThreadListItemPrimitive.Delete
            asChild
            onClick={() => onOpenChange(false)}
          >
            <Button type="button" variant="destructive">
              <TrashIcon className="size-4" />
              Delete
            </Button>
          </ThreadListItemPrimitive.Delete>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
