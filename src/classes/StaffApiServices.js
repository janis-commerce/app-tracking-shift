import Request from "@janiscommerce/app-request";

class StaffApiServices {
    constructor({environment}) {
        this.environment = environment;
        this.request = new Request({JANIS_ENV: this.environment});
        this.service = "staff";
    }

    async openShift() {
        try {
            return await this.request.post({
                service: this.service,
                namespace: "shift-open",
            })
        } catch(error) {
            return Promise.reject(error)
        }
    }

    async closeShift() {
        try {
            return await this.request.post({
                service: this.service,
                namespace: "shift-close",
            })
        } catch(error) {
            return Promise.reject(error)
        }
    }

    async createWorklog(params = {}) {
        const {referenceId, startTime, endTime} = params;
        try {
            return await this.request.post({
                service: this.service,
                namespace: "work-log",
                body: {
                    workLogTypeRefId: referenceId,
                    startDate:startTime,
                    endDate:endTime,
                }
            })
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getWorkLogTypes() {
        try {
            return await this.request.list({
                service: this.service,
                namespace: "work-log-type",
                headers: {
                    pageSize: 100,
                },
                queryParams: {
                    filters: {
                        status: "active",
                        type: ["work", "pause", "problem"]
                    }
                }
            })
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

export default StaffApiServices;