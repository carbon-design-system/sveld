<script>
  /**
   * @typedef {object} NotificationData
   * @property {string} [id] - Optional id for deduplication
   * @property {"error" | "info" | "success"} [kind]
   * @property {string} [title]
   */

  /**
   * Add a notification to the queue.
   * If a notification with the same id exists, the call is ignored.
   * @param {NotificationData} notification
   * @returns {string} The notification id
   */
  export function add(notification) {
    const id = notification.id ?? "id";
    return id;
  }

  /**
   * Remove a notification by id.
   * @param {string} id
   * @returns {boolean} True if the notification was found and removed
   */
  export function remove(id) {
    return true;
  }

  /**
   * Clear all notifications.
   * @returns {void}
   */
  export function clear() {}

  /**
   * Get notification count.
   * @returns {number} The number of notifications
   */
  export function getCount() {
    return 0;
  }

  /**
   * Update a notification.
   * @param {string} id - The notification id
   * @param {NotificationData} data - The updated notification data
   * @returns {boolean} True if the notification was updated
   */
  export function update(id, data) {
    return true;
  }

  /**
   * Function with only @param, no @returns (should default to any)
   * @param {string} message
   */
  export function log(message) {
    console.log(message);
  }
</script>

