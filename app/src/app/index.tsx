import { View } from "react-native";

import { Button } from "@/components/Button";
import { Group } from "@/components/Group";
import { Row } from "@/components/Row";

// Temporary — verifies Group/Row/Button work together visually. Remove once
// ExploreScreen exists for real.
export default function Index() {
  return (
    <View className="flex-1 justify-center gap-6 bg-canvas px-4">
      <Group header="LIBRE AHORA MISMO">
        <Row
          title="Sala Boreal 204"
          subtitle="Piso 2 · 8 personas · hasta 15:30"
          trailing="action"
          actionLabel="Apartar"
          actionTone="filled"
          onActionPress={() => {}}
        />
        <Row
          title="Cabina de audio 3"
          subtitle="Piso 1 · 1 persona · hasta 15:15"
          trailing="action"
          actionLabel="Apartar"
          actionTone="wash"
          onActionPress={() => {}}
        />
        <Row
          title="Escritorio flex 12B"
          meta="Último lugar · hasta 14:45"
          metaTone="last"
          trailing="chevron"
          onPress={() => {}}
        />
      </Group>

      <Button variant="filled" onPress={() => {}}>
        Apartar 14:00
      </Button>
    </View>
  );
}
