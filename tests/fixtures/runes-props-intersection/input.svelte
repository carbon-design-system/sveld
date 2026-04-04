<script lang="ts">
  interface BaseProps {
    label: string;
  }

  type ExtraProps = {
    disabled?: boolean;
  };

  type Props = BaseProps & ExtraProps;

  let { label, disabled }: Props = $props();
</script>

<button {disabled}>{label}</button>
