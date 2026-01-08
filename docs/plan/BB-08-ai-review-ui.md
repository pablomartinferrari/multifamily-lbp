# BB-08: AI Normalization Review Component

> **Priority**: 🟢 Medium  
> **Estimated Effort**: 4-5 hours  
> **Dependencies**: BB-06, BB-07  
> **Status**: ✅ Complete

---

## Objective

Create a modal/panel that displays AI normalization suggestions and allows users to accept, reject, or edit them before applying.

---

## Prerequisites

- BB-06 completed (Azure OpenAI integration)
- BB-07 completed (File Upload component)

---

## Tasks

### 1. Create Review Component

Create `src/webparts/xrfProcessor/components/AINormalizationReview/AINormalizationReview.tsx`:

```typescript
import * as React from "react";
import {
  Panel,
  PanelType,
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  IconButton,
  TextField,
  MessageBar,
  MessageBarType,
} from "@fluentui/react";
import { IComponentNormalization } from "../../../../models/INormalization";
import styles from "./AINormalizationReview.module.scss";

export interface IAINormalizationReviewProps {
  isOpen: boolean;
  normalizations: IComponentNormalization[];
  onApprove: (approved: IComponentNormalization[]) => void;
  onCancel: () => void;
}

interface INormalizationState extends IComponentNormalization {
  isAccepted: boolean;
  editedName?: string;
}

export const AINormalizationReview: React.FC<IAINormalizationReviewProps> = ({
  isOpen,
  normalizations,
  onApprove,
  onCancel,
}) => {
  const [items, setItems] = React.useState<INormalizationState[]>([]);

  React.useEffect(() => {
    setItems(normalizations.map(n => ({ ...n, isAccepted: n.confidence >= 0.8 })));
  }, [normalizations]);

  const handleToggle = (index: number) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, isAccepted: !item.isAccepted } : item
    ));
  };

  const handleEdit = (index: number, newName: string) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, editedName: newName } : item
    ));
  };

  const handleApprove = () => {
    const approved = items
      .filter(item => item.isAccepted)
      .map(item => ({
        ...item,
        normalizedName: item.editedName || item.normalizedName,
      }));
    onApprove(approved);
  };

  const acceptAllHighConfidence = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      isAccepted: item.confidence >= 0.8,
    })));
  };

  const aiItems = items.filter(i => i.source === "AI");
  const cachedItems = items.filter(i => i.source === "CACHE");

  return (
    <Panel
      isOpen={isOpen}
      type={PanelType.medium}
      headerText="🤖 AI Component Normalization"
      onDismiss={onCancel}
      onRenderFooterContent={() => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <PrimaryButton text="Apply Selected" onClick={handleApprove} />
          <DefaultButton text="Cancel" onClick={onCancel} />
        </Stack>
      )}
    >
      <Stack tokens={{ childrenGap: 16 }} className={styles.container}>
        {cachedItems.length > 0 && (
          <MessageBar messageBarType={MessageBarType.info}>
            {cachedItems.length} component(s) found in cache (previously approved)
          </MessageBar>
        )}

        {aiItems.length > 0 && (
          <>
            <Stack horizontal horizontalAlign="space-between">
              <Text variant="large">New AI Suggestions</Text>
              <DefaultButton text="Accept All High Confidence" onClick={acceptAllHighConfidence} />
            </Stack>

            {aiItems.map((item, index) => (
              <div key={item.originalName} className={`${styles.card} ${item.isAccepted ? styles.accepted : ""}`}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Stack>
                    <Text variant="small" className={styles.original}>"{item.originalName}"</Text>
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                      <Text>→</Text>
                      <TextField
                        value={item.editedName || item.normalizedName}
                        onChange={(_, v) => handleEdit(index, v || "")}
                        styles={{ root: { width: 200 } }}
                      />
                    </Stack>
                    <Text variant="small" className={styles.confidence}>
                      Confidence: {Math.round(item.confidence * 100)}%
                    </Text>
                  </Stack>
                  <IconButton
                    iconProps={{ iconName: item.isAccepted ? "CheckMark" : "Cancel" }}
                    onClick={() => handleToggle(index)}
                    className={item.isAccepted ? styles.acceptBtn : styles.rejectBtn}
                  />
                </Stack>
              </div>
            ))}
          </>
        )}
      </Stack>
    </Panel>
  );
};
```

### 2. Create Styles

Create `src/webparts/xrfProcessor/components/AINormalizationReview/AINormalizationReview.module.scss`:

```scss
.container {
  padding: 16px 0;
}

.card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;

  &.accepted {
    border-color: #107c10;
    background: #f0fff0;
  }
}

.original {
  color: #666;
  margin-bottom: 8px;
}

.confidence {
  color: #888;
  margin-top: 8px;
}

.acceptBtn {
  color: #107c10;
}

.rejectBtn {
  color: #a80000;
}
```

---

## Acceptance Criteria

- [ ] Shows AI suggestions in a modal/panel
- [ ] Displays original name, normalized name, confidence
- [ ] Can accept/reject individual suggestions
- [ ] Can edit normalized names
- [ ] "Accept All High Confidence" bulk action works
- [ ] Shows cached items separately

---

## Output Artifacts

```
src/webparts/xrfProcessor/components/AINormalizationReview/
├── AINormalizationReview.tsx
└── AINormalizationReview.module.scss
```

---

## Next Steps

➡️ Proceed to **BB-09: Results Summary Component**



