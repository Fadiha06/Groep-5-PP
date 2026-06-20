const AdminDashboardModel = require('../models/adminDashboardModel');
const ContractModel = require('../models/contractModel');

// Contracten die wachten op juridische controle + ondertekening door de stagecommissie.
exports.getActionRequired = async (req, res) => {
    try {
        const items = await AdminDashboardModel.getActionRequired();
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van actie vereist items' });
    }
};

exports.getContractControle = async (req, res) => {
    try {
        const contractId = req.params.id;
        const dbContract = await AdminDashboardModel.getContractControle(contractId);
        if (!dbContract) {
            return res.status(404).json({ error: 'Contract niet gevonden' });
        }

        // Map DB result to frontend expected structure
        const contract = {
            contract_id: dbContract.contract_id,
            bedrijf_naam: dbContract.bedrijf_naam || 'Onbekend',
            student_naam: dbContract.student_naam || 'Onbekend',
            opleiding: dbContract.opleiding || 'Onbekend',
            periode_start: dbContract.periode_start,
            periode_eind: dbContract.periode_eind,
            status_contract: dbContract.status_contract,
            ingediend_op: dbContract.ingediend_op,
            handtekeningen: {
                student: {
                    naam: dbContract.student_naam,
                    getekend_op: dbContract.student_getekend ? dbContract.getekend_op : null,
                    status: dbContract.student_getekend ? 'aanwezig' : 'ontbreekt'
                },
                mentor: {
                    naam: 'Mentor Bedrijf',
                    getekend_op: dbContract.mentor_getekend ? dbContract.getekend_op : null,
                    status: dbContract.mentor_getekend ? 'aanwezig' : 'ontbreekt'
                },
                // "docent_getekend" is een historische kolomnaam — dit signaleert de
                // ondertekening door de stagecommissie als verantwoordelijke instelling.
                instelling: {
                    naam: 'Stagecommissie',
                    getekend_op: dbContract.docent_getekend ? dbContract.getekend_op : null,
                    status: dbContract.docent_getekend ? 'aanwezig' : 'ontbreekt'
                }
            },
            checklist: [
                { item_id: 1, label: "Risicoanalyse ingevuld en geüpload", verplicht: true, afgevinkt: false },
                { item_id: 2, label: "Werkpostfiche aanwezig en ondertekend", verplicht: true, afgevinkt: false },
                { item_id: 3, label: "Voldoet aan minimale stage-uren", verplicht: true, afgevinkt: false },
                { item_id: 4, label: "Verzekeringsattest doorgestuurd", verplicht: false, afgevinkt: false }
            ],
            opmerking: ""
        };

        res.json(contract);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van contract controle data' });
    }
};

exports.saveContractControle = async (req, res) => {
    try {
        const contractId = req.params.id;
        const { checklist, opmerking } = req.body;
        // Mock save logic for now
        res.json({ message: 'Opgeslagen' });
    } catch (err) {
        res.status(500).json({ error: 'Fout bij opslaan' });
    }
};

exports.rejectContract = async (req, res) => {
    try {
        const contractId = req.params.id;
        const { opmerking } = req.body;
        await AdminDashboardModel.updateContractState(contractId, 'geweigerd', opmerking);
        res.json({ message: 'Afgewezen' });
    } catch (err) {
        res.status(500).json({ error: 'Fout bij afwijzen' });
    }
};

exports.approveContract = async (req, res) => {
    try {
        const contractId = req.params.id;
        const { signature } = req.body;

        const contract = await ContractModel.getById(contractId);
        if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });

        // "signAsDocent" is een historische methodenaam — dit tekent het contract
        // namens de stagecommissie als verantwoordelijke instelling.
        if (!contract.docent_getekend) {
            if (!signature) return res.status(400).json({ error: 'Handtekening ontbreekt' });
            await ContractModel.signAsDocent(contractId, signature);
        }

        await AdminDashboardModel.updateContractState(contractId, 'goedgekeurd', null);
        res.json({ message: 'Goedgekeurd en getekend' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fout bij goedkeuren' });
    }
};
