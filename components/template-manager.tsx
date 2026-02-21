"use client"

import { useState } from "react"
import { Plus, Trash2, Edit2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { MessageTemplate } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TemplateManagerProps {
  templates: MessageTemplate[]
  onAddTemplate: (name: string, content: string) => void
  onDeleteTemplate: (id: string) => void
  onUpdateTemplate: (id: string, name: string, content: string) => void
  onSelectTemplate: (template: MessageTemplate) => void
}

export function TemplateManager({
  templates,
  onAddTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  onSelectTemplate,
}: TemplateManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateContent, setTemplateContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editContent, setEditContent] = useState("")

  const handleAddTemplate = () => {
    if (templateName.trim() && templateContent.trim()) {
      onAddTemplate(templateName, templateContent)
      setTemplateName("")
      setTemplateContent("")
    }
  }

  const handleStartEdit = (template: MessageTemplate) => {
    setEditingId(template.id)
    setEditName(template.name)
    setEditContent(template.content)
  }

  const handleSaveEdit = () => {
    if (editingId && editName.trim() && editContent.trim()) {
      onUpdateTemplate(editingId, editName, editContent)
      setEditingId(null)
      setEditName("")
      setEditContent("")
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditContent("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8" title="Manage message templates">
          <Plus className="h-4 w-4 mr-1" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>Create and manage reusable message templates</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create New Template */}
          <div className="space-y-2 p-3 border rounded-lg bg-secondary/50">
            <h4 className="text-sm font-semibold">Create New Template</h4>
            <Input
              placeholder="Template name (e.g., 'Follow-up')"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-sm"
            />
            <Textarea
              placeholder="Template content"
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              className="text-sm resize-none h-24"
            />
            <Button
              onClick={handleAddTemplate}
              disabled={!templateName.trim() || !templateContent.trim()}
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Template
            </Button>
          </div>

          {/* Templates List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Saved Templates ({templates.length})</h4>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No templates yet. Create one to get started!</p>
            ) : (
              <ScrollArea className="h-64 pr-4">
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div key={template.id}>
                      {editingId === template.id ? (
                        // Edit mode
                        <div className="space-y-2 p-3 border rounded-lg bg-secondary/50">
                          <Input
                            placeholder="Template name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="text-sm"
                          />
                          <Textarea
                            placeholder="Template content"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="text-sm resize-none h-20"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveEdit}
                              disabled={!editName.trim() || !editContent.trim()}
                              size="sm"
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button onClick={handleCancelEdit} variant="outline" size="sm" className="flex-1 bg-transparent">
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div
                          className={cn(
                            "p-3 border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group",
                            "bg-secondary/30",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div
                              onClick={() => {
                                onSelectTemplate(template)
                                setIsOpen(false)
                              }}
                              className="flex-1 min-w-0"
                            >
                              <h5 className="text-sm font-medium truncate">{template.name}</h5>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{template.content}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                onClick={() => handleStartEdit(template)}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                onClick={() => onDeleteTemplate(template.id)}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
