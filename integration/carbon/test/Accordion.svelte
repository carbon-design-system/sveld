<script lang="ts">
  import { Accordion, AccordionItem, Checkbox } from "../types";
  import Button from "../types/Button/Button.svelte";
</script>

<Accordion size="xl">
  <AccordionItem>Content</AccordionItem>
</Accordion>

<Button>Text</Button>

<Checkbox on:check />