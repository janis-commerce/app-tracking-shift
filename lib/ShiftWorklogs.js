class ShiftWorklogs {

    /**
     * Parses and simplifies the structure of work records obtained from the personnel MS
.
     * @param {Array} worklogTypes => Array of worklog types
     * @returns {Array} worklogTypes => Array of worklog types
     */

    prepareWorkLogTypes(worklogTypes = []) {
        return worklogTypes.map((workType) => {
            const {id, referenceId, name, description = '', type = '', suggestedTime = 0} = workType || {};

            if(!id || !referenceId) return;

            return {
                id,
                referenceId,
                worklogName: name,
                type,
                description,
                suggestedTime,
            }
        }).filter(Boolean);
    }
}

export default ShiftWorklogs;