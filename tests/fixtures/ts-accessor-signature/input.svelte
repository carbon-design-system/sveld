<script lang="ts">
  export function process(input: string): number {
    return input.length;
  }

  export function log(message: string, level): void {
    console.log(level, message);
  }

  export function sum(...values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }
</script>

<slot />
