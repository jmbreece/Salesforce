import { LightningElement, api, track } from "lwc";
import Id from "@salesforce/user/Id";
import getAccounts from "@salesforce/apex/BrokerAccountController.getAccounts";
import claimAccounts from "@salesforce/apex/BrokerAccountController.claimAccounts";

const COLS = [
    { label: "Name", fieldName:"accountLink", type:"url", sortable:"true", typeAttributes: { label: { fieldName:"Name"}, tooltip:"Name", target:"_self" }},
    { label: "NMLS", fieldName:"Location_NMLS_ID__c", type:"text", sortable:"true" },
    { label: "City", fieldName:"BillingCity", type:"text", sortable:"true" },
    { label: "State", fieldName:"BillingState", type:"text", sortable:"true" },
//    { label: "Channel", fieldName:"Broker_Channel__c", type:"text", sortable:"true" },
    { label: "Owner", fieldName:"Account_Owner_Name__c", type:"text", sortable:"true" },
//    { label: "Status", fieldName:"Location_Status__c", type:"text", sortable:"true" },
    { label: "Created", fieldName: "CreatedDate", type: "date-local", sortable:"true" } 
]

export default class brokerAgencyByOwner extends LightningElement {

    @api flexipageRegionWidth;
    @api columns = COLS;
    @api userid = Id;
    @api error;
    @api srchfld='';
    @api srchval='';
    @track accounts=[];
    accountsSelected=[];
    ownerId='';
    rowLimit=25;
    rowOffSet=0;
    maxLimit=2000;
    rowsReturned=0;
    enableInfLoad=true;
    isLoading=false;
    disableClaim=false;
    
    @api searchIconName = 'utility:search';
    @api downloadIconName = 'utility:download';
    @api claimIconName = 'action:change_owner';
    @api claimButtonLabel = 'Claim';
    @api searchButtonLabel = 'Search';
    @api downloadButtonLabel = 'Download';
    get enableInfiniteLoading() { return this.enableInfLoad }
    get isLoading() { return this.isLoading }
    get searchValue() { return this.srchval }
    get searchField() { return this.srchfld }
    get disableClaim() { return this.disableClaim }

    defaultSortDirection = 'asc';
    @track sortedBy='';
    @track sortDirection='asc';
    @api ownerValue='unclaimed';
    get defaultSortDirection() { return this.defaultSortDirection }
    get sortedBy() { return this.sortedBy }
    get sortDirection() { return this.sortDirection }
    get accountOwner(){ return this.ownerValue }

    // LOADS FIRST ROWS  
    connectedCallback() {
        this.enableInfLoad=true;
        this.isLoading=false;
        this.rowOffSet=0;
        this.loadData();
    }
    // LOADS ROWS UP TO ROWLIMIT 
    loadData() {
        this.enableInfLoad=true;
        getAccounts({ fieldName: this.srchfld, fieldValue: this.srchval, limitSize: this.rowLimit, offset: this.rowOffSet, sortField: this.sortedBy, direction: this.sortDirection, ownerId: this.ownerId })
        .then ((data) => {
            this.rowsReturned=data.length;
            // CREATING LINK FIELD 
            var tempData = [];  
            for (var i = 0; i < data.length; i++) {  
                var tempRecord = Object.assign({}, data[i]); //cloning object  
                tempRecord.accountLink = "/" + tempRecord.Id;  
                tempData.push(tempRecord);  
            }  
            this.accounts=this.accounts.concat(tempData);
            this.error=undefined;
            this.isLoading=false;
            if ( this.rowsReturned < this.rowLimit ) { this.enableInfLoad = false; }
        })
        .catch(error => {
            this.error = error;
            this.accounts = undefined;
            this.isLoading=false;
        })
    }
    // LOADS MORE ROWS WHEN MORE ARE NEEDED 
    loadMoreData(event) {
        if ( this.rowOffSet + this.rowLimit <= this.maxLimit ){
            this.rowOffSet = this.rowOffSet + this.rowLimit;
        }
        this.isLoading=true;
        this.loadData();
        if ( this.rowsReturned = 0 ) {
            this.enableInfLoad=false;
            this.isLoading=false;
            this.rowOffSet=0;
        } 
    }

    // Handles click Search button
    handleSearchClick(event) {
        this.srchval = this.template.querySelector('lightning-input').value;
        this.enableInfLoad=true;
        this.rowOffSet=0;
        this.accounts=[];
        this.loadData();
    }

    handleSrchFieldChange(event) {
        this.srchfld = event.detail.value;
        this.srchval = '';
        if (this.srchfld == '' ) {
            this.rowOffSet=0;
            this.accounts=[];
            this.loadData();
        }
    }

    get srchFieldList() {
        return [
            { label: '--None--', value: '' },            
            { label: 'Name *', value: 'Name' },            
            { label: 'NMLS', value: 'Location_NMLS_ID__c' },            
            { label: 'City *', value: 'BillingCity' },            
            { label: 'State', value: 'BillingState' },            
            { label: 'Channel', value: 'Broker_Channel__c' },            
            { label: 'Status', value: 'Location_Status__c' }
        ] 
    }

    // The method onsort event handler
    onHandleSort(event) {
        var fieldName = event.detail.fieldName;
        var sortOrder = event.detail.sortDirection;
        this.sortedBy = fieldName;
        this.sortDirection = sortOrder;
        this.rowOffSet=0;
        this.accounts=[];
        this.loadData();
    }

    // radio button values: queue or mine
    get ownerOptions() {
        return [
            { label: 'Unclaimed', value: 'unclaimed' },            
            { label: 'Mine', value: 'mine' },            
        ] 
    }
    // handle owner radio button click; queue | mine
    handleAccountOwner(event) {
        this.ownerValue = event.detail.value;
        if ( this.ownerValue == 'mine' ) {
            this.ownerId = this.userid;
            this.disableClaim=true;
        } else {
            this.ownerId='';
            this.disableClaim=false;
        }
        this.srchval = '';
        this.srchfld = ''; 
        this.isLeadLoading=false;
        this.rowOffSet=0;
        this.accounts=[];
        this.loadData();
    }

    // handle row selection
    onHandleSelection(event){
        this.accountsSelected=[];
        const selectedRows = event.detail.selectedRows;
        for (let i = 0; i < selectedRows.length; i++){
            this.accountsSelected.push(selectedRows[i].Id);
        }
    }

     // handle Claim button click 
     handleAccountClaim(event) {
        this.isProcessing=true;
        claimAccounts({ accountIds: this.accountsSelected, userId: this.userid })
        .then ((claimed) => {
            var nbrRows=claimed.length;
            this.isProcessing=false;
        })
        .catch(error => {
            this.error = error;
            this.accounts = undefined;
            alert('error: ' + this.error);
        })
        this.srchfld = '';
        this.srchval = '';
        this.isProcessing=false;
        this.isLeadLoading=false;
        this.rowOffSet=0;
        this.accounts=[];
        this.loadData();
    }
   
    // this method validates the data and creates the csv file to download
    handleDownloadClick() {   
        let rowEnd = '\n';
        let csvString = '';
        this.enableInfLoad=false;
        this.isLoading=false;
        this.rowOffSet = this.accounts.length+1;
        this.rowLimit = 0;
        this.loadData();

        this.enableInfLoad=true;
        this.rowOffSet = 0;

        // this set elminates the duplicates if have any duplicate keys
        let rowData = new Set();

        // getting keys from data
        this.accounts.forEach(function (record) {
            Object.keys(record).forEach(function (key) {
                rowData.add(key);
            });
        });

        // Array.from() method returns an Array object from any object with a length property or an iterable object.
        rowData = Array.from(rowData);
        
        // splitting using ','
        csvString += rowData.join(',');
        csvString += rowEnd;

        // main for loop to get the data based on key value
        for(let i=0; i < this.accounts.length; i++){
            let colValue = 0;

            // validating keys in data
            for(let key in rowData) {
                if(rowData.hasOwnProperty(key)) {
                    // Key value 
                    // Ex: Id, Name
                    let rowKey = rowData[key];
                    // add , after every value except the first.
                    if(colValue > 0){
                        csvString += ',';
                    }
                    // If the column is undefined, it as blank in the CSV file.
                    let value = this.accounts[i][rowKey] === undefined ? '' : this.accounts[i][rowKey];
                    csvString += '"'+ value +'"';
                    colValue++;
                }
            }
            csvString += rowEnd;
        }

        // Creating anchor element to download
        let downloadElement = document.createElement('a');

        // This  encodeURI encodes special characters, except: , / ? : @ & = + $ # (Use encodeURIComponent() to encode these characters).
        downloadElement.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
        downloadElement.target = '_self';
        // CSV File Name
        downloadElement.download = 'export_accounts.csv';
        // below statement is required if you are using firefox browser
        document.body.appendChild(downloadElement);
        // click() Javascript function to download CSV file
        downloadElement.click(); 
    }    
}