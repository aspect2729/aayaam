"use client";

import { Send } from "lucide-react";
import { BrainMark } from "@/components/shared/brain-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { askSuggestions } from "@/lib/mock-data";
import { useAskBrain } from "@/lib/ask-brain";
import { useBusiness } from "@/lib/business-context";

export function AskBrainDrawer() {
  const { open, setOpen, messages, draft, setDraft, send, openWith } = useAskBrain();
  const { addTask } = useBusiness();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-[min(100%,460px)] p-0">
        <SheetHeader>
          <SheetTitle>Ask Business Brain</SheetTitle>
          <SheetDescription>A preview conversation. Nothing is sent to a model.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="ml-8 rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-white">
                  {message.text}
                </div>
              ) : (
                <div key={message.id} className="mr-4 rounded-2xl rounded-bl-md border border-line bg-[#F8FAFF] p-3">
                  <BrainMark />
                  {message.answer ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <p className="text-[13px] font-medium text-secondary">What changed</p>
                        <ul className="mt-1 space-y-1">
                          {message.answer.changed.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-secondary">Why</p>
                        <ul className="mt-1 space-y-1">
                          {message.answer.why.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-secondary">Recommended actions</p>
                        <ul className="mt-2 space-y-2">
                          {message.answer.actions.map((item) => (
                            <li key={item} className="flex items-start justify-between gap-2 rounded-inner border border-line bg-white px-2.5 py-2">
                              <span>{item}</span>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="shrink-0"
                                onClick={() => {
                                  addTask(item);
                                  toast({ title: "Task created", description: "It is on the Operations list." });
                                }}
                              >
                                Create task
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {askSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="rounded-full border border-line bg-white px-3 py-1 text-[12px] text-secondary hover:border-chip-blue-border hover:text-accent"
                  onClick={() => openWith(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <form
            className="flex gap-2 border-t border-line p-4"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about sales, leads, or margin"
              aria-label="Message Business Brain"
            />
            <Button type="submit" size="icon" aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
